"""Concurrent cache misses: requests that overlap on one cold key share a
single provider call.

Every test drives its whole scenario inside one ``asyncio.run`` so the
requests really are in flight at the same time.
"""

import asyncio
import gc
import itertools
import logging
import traceback
from collections.abc import Awaitable, Callable, Iterator
from datetime import datetime, timedelta, timezone

import pytest

from app.core.cache import TTLCache
from app.models.flight import (
    Airport,
    Flight,
    FlightLookupResponse,
    FlightSnapshot,
    FlightsResponse,
    FlightType,
)
from app.providers.base import FlightProvider, ProviderError, RateLimitError
from app.services.flight_service import FlightService

CALLERS = 20
CACHE_TTL_SECONDS = 300
START = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

Response = FlightsResponse | FlightLookupResponse
Request = Callable[[FlightService], Awaitable[Response]]


class GatedProvider(FlightProvider):
    """A FlightProvider stand-in whose calls stay open until the test lets
    them finish.

    A fake that returned straight away would never be in the middle of a call
    when the next request arrived, so nothing would overlap and these tests
    would pass with or without request collapsing. Here every call parks on
    ``gate`` until the test sets it; ``entered`` is set once a call is parked.

    ``calls`` records each call that reached the provider and ``waiting`` is
    how many are parked right now. When ``error`` is set, a call raises a new
    instance of it after the gate opens instead of returning flights.
    """

    def __init__(self, error: type[ProviderError] | None = None) -> None:
        self.error = error
        self.gate = asyncio.Event()
        self.entered = asyncio.Event()
        self.calls: list[str] = []
        self.waiting = 0

    async def get_flights(self, airport: str, flight_type: FlightType) -> list[Flight]:
        return await self._call(f"{airport}:{flight_type}")

    async def get_flight_by_number(self, flight_number: str) -> list[Flight]:
        return await self._call(f"lookup:{flight_number}")

    async def _call(self, label: str) -> list[Flight]:
        self.calls.append(label)
        self.waiting += 1
        self.entered.set()
        try:
            await self.gate.wait()
        finally:
            self.waiting -= 1
        if self.error is not None:
            raise self.error("upstream said no")
        return [_make_flight()]


def _make_flight() -> Flight:
    return Flight(
        flight_number="AA1",
        airline="Test Air",
        origin=Airport(iata="JFK"),
        destination=Airport(iata="LAX"),
        status="scheduled",
    )


def _make_service(
    provider: FlightProvider,
    cache: TTLCache[FlightSnapshot] | None = None,
    clock: Callable[[], datetime] | None = None,
) -> FlightService:
    if cache is None:
        cache = TTLCache(ttl_seconds=CACHE_TTL_SECONDS)
    return FlightService(provider=provider, cache=cache, clock=clock)


def _ticking_clock() -> Callable[[], datetime]:
    """A wall clock that moves on one second every time it is read, so two
    separately stamped fetches can never report the same time."""
    ticks = itertools.count()
    return lambda: START + timedelta(seconds=next(ticks))


async def _let_tasks_run() -> None:
    """Give every task that can make progress the chance to run until it
    blocks again. No real time passes."""
    for _ in range(10):
        await asyncio.sleep(0)


def _start(
    request_flights: Request, service: FlightService, count: int
) -> list[asyncio.Task[Response]]:
    return [asyncio.ensure_future(request_flights(service)) for _ in range(count)]


# The airport search and the flight-number lookup share the collapsing logic
# and must behave the same way, so most tests below run against both.
both_paths = pytest.mark.parametrize(
    "request_flights",
    [
        pytest.param(lambda service: service.get_flights("JFK", "departures"), id="airport"),
        pytest.param(lambda service: service.get_flight_by_number("DL2042"), id="lookup"),
    ],
)

both_errors = pytest.mark.parametrize("error", [ProviderError, RateLimitError])


@pytest.fixture(autouse=True)
def asyncio_has_nothing_to_report() -> Iterator[None]:
    """Fail a test that leaves asyncio with an error to log.

    "Task exception was never retrieved" and "Task was destroyed but it is
    pending" are written to the ``asyncio`` logger when the task is garbage
    collected. They are not Python warnings, so ``-W error`` does not turn
    them into failures; this does.
    """
    records: list[logging.LogRecord] = []

    class Collect(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            records.append(record)

    handler = Collect()
    logger = logging.getLogger("asyncio")
    logger.addHandler(handler)
    try:
        yield
        gc.collect()
    finally:
        logger.removeHandler(handler)

    assert [record.getMessage() for record in records] == []


# --- one provider call for concurrent misses ---------------------------------


@both_paths
def test_concurrent_requests_for_a_cold_key_call_the_provider_once(
    request_flights: Request,
) -> None:
    async def scenario() -> tuple[GatedProvider, list[Response]]:
        provider = GatedProvider()
        service = _make_service(provider)

        requests = asyncio.gather(*(request_flights(service) for _ in range(CALLERS)))
        # The first call is now parked inside the provider, and every other
        # request has had the chance to make a call of its own.
        await provider.entered.wait()
        await _let_tasks_run()
        calls_while_in_flight = len(provider.calls)

        provider.gate.set()
        responses = await requests
        assert calls_while_in_flight == len(provider.calls)
        return provider, responses

    provider, responses = asyncio.run(scenario())

    assert len(provider.calls) == 1
    assert len(responses) == CALLERS
    assert all(response.flights == [_make_flight()] for response in responses)


@both_paths
def test_requests_sharing_a_fetch_report_one_fetch_time_and_not_cached(
    request_flights: Request,
) -> None:
    async def scenario() -> tuple[list[Response], Response]:
        provider = GatedProvider()
        service = _make_service(provider, clock=_ticking_clock())

        requests = asyncio.gather(*(request_flights(service) for _ in range(CALLERS)))
        await provider.entered.wait()
        provider.gate.set()
        responses = await requests
        return responses, await request_flights(service)

    responses, later = asyncio.run(scenario())

    # Every one of them waited on the provider call, so none was served from
    # the cache, and the call was stamped exactly once.
    assert [response.cached for response in responses] == [False] * CALLERS
    assert {response.fetched_at for response in responses} == {START}
    # Only a request that arrives after the fetch has finished is a cache hit.
    assert later.cached is True
    assert later.fetched_at == START


def test_concurrent_requests_after_expiry_share_one_refetch() -> None:
    monotonic = [1_000.0]

    async def scenario() -> tuple[GatedProvider, list[FlightsResponse]]:
        provider = GatedProvider()
        cache: TTLCache[FlightSnapshot] = TTLCache(
            ttl_seconds=CACHE_TTL_SECONDS, clock=lambda: monotonic[0]
        )
        service = _make_service(provider, cache=cache)
        provider.gate.set()
        await service.get_flights("JFK", "departures")

        monotonic[0] += CACHE_TTL_SECONDS
        provider.gate.clear()
        requests = asyncio.gather(
            *(service.get_flights("JFK", "departures") for _ in range(CALLERS))
        )
        await _let_tasks_run()
        provider.gate.set()
        return provider, await requests

    provider, responses = asyncio.run(scenario())

    assert provider.calls == ["JFK:departures", "JFK:departures"]
    assert [response.cached for response in responses] == [False] * CALLERS


def test_different_keys_fetch_at_the_same_time() -> None:
    async def scenario() -> tuple[GatedProvider, int]:
        provider = GatedProvider()
        service = _make_service(provider)

        requests = asyncio.gather(
            service.get_flights("JFK", "departures"),
            service.get_flights("JFK", "arrivals"),
            service.get_flights("LAX", "departures"),
            service.get_flight_by_number("DL2042"),
            service.get_flight_by_number("AA100"),
        )
        # Nothing has been released yet. If one key's fetch held the others
        # back, only one call would have reached the provider by now.
        await _let_tasks_run()
        waiting_together = provider.waiting

        provider.gate.set()
        await requests
        return provider, waiting_together

    provider, waiting_together = asyncio.run(scenario())

    assert waiting_together == 5
    assert sorted(provider.calls) == [
        "JFK:arrivals",
        "JFK:departures",
        "LAX:departures",
        "lookup:AA100",
        "lookup:DL2042",
    ]


# --- provider failures --------------------------------------------------------


@both_paths
@both_errors
def test_provider_failure_reaches_every_waiter(
    request_flights: Request, error: type[ProviderError]
) -> None:
    async def scenario() -> tuple[GatedProvider, list[Response | BaseException]]:
        provider = GatedProvider(error=error)
        service = _make_service(provider)

        requests = asyncio.gather(
            *(request_flights(service) for _ in range(CALLERS)), return_exceptions=True
        )
        await provider.entered.wait()
        await _let_tasks_run()
        provider.gate.set()
        return provider, await requests

    provider, results = asyncio.run(scenario())

    assert len(provider.calls) == 1
    # The exact type, so a rate limit is still told apart from other failures.
    assert [type(result) for result in results] == [error] * CALLERS
    assert {str(result) for result in results} == {"upstream said no"}


@both_paths
@both_errors
def test_provider_failure_is_not_cached(
    request_flights: Request, error: type[ProviderError]
) -> None:
    async def scenario() -> tuple[GatedProvider, int, Response, Response]:
        provider = GatedProvider(error=error)
        cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=CACHE_TTL_SECONDS)
        service = _make_service(provider, cache=cache)

        requests = asyncio.gather(
            *(request_flights(service) for _ in range(CALLERS)), return_exceptions=True
        )
        await provider.entered.wait()
        provider.gate.set()
        await requests
        entries_after_failure = len(cache)

        # The provider has recovered by the time the next request arrives.
        provider.error = None
        after_failure = await request_flights(service)
        after_recovery = await request_flights(service)
        return provider, entries_after_failure, after_failure, after_recovery

    provider, entries_after_failure, after_failure, after_recovery = asyncio.run(scenario())

    assert entries_after_failure == 0
    # The request after the failure went back to the provider...
    assert len(provider.calls) == 2
    assert after_failure.cached is False
    assert after_failure.flights == [_make_flight()]
    # ...and its result, unlike the failure, was cached.
    assert after_recovery.cached is True


@both_paths
def test_repeated_failures_each_call_the_provider_again(request_flights: Request) -> None:
    async def scenario() -> tuple[GatedProvider, list[Response | BaseException]]:
        provider = GatedProvider(error=ProviderError)
        service = _make_service(provider)
        provider.gate.set()

        results: list[Response | BaseException] = []
        for _ in range(3):
            results += await asyncio.gather(request_flights(service), return_exceptions=True)
        return provider, results

    provider, results = asyncio.run(scenario())

    assert len(provider.calls) == 3
    assert [type(result) for result in results] == [ProviderError] * 3
    # Each failure is the provider's own new exception, not a stored one.
    assert len({id(result) for result in results}) == 3


@both_paths
def test_request_arriving_just_as_a_fetch_fails_starts_its_own_fetch(
    request_flights: Request,
) -> None:
    async def scenario() -> tuple[GatedProvider, list[Response | BaseException]]:
        provider = GatedProvider(error=ProviderError)
        service = _make_service(provider)

        first = asyncio.ensure_future(request_flights(service))
        await provider.entered.wait()

        # Opening the gate queues the failing fetch to resume. The request
        # created right behind it runs in the same pass of the event loop:
        # after the fetch has failed, before anything has reacted to that.
        provider.gate.set()
        late = asyncio.ensure_future(request_flights(service))
        results = await asyncio.gather(first, late, return_exceptions=True)
        assert service._in_flight == {}
        return provider, results

    provider, results = asyncio.run(scenario())

    # The late request was not handed the failure that predates it.
    assert len(provider.calls) == 2
    assert [type(result) for result in results] == [ProviderError] * 2
    assert results[0] is not results[1]


def test_shared_failure_traceback_does_not_grow_with_the_number_of_waiters() -> None:
    def traceback_depth(callers: int) -> int:
        async def scenario() -> list[FlightsResponse | BaseException]:
            provider = GatedProvider(error=RateLimitError)
            service = _make_service(provider)
            requests = asyncio.gather(
                *(service.get_flights("JFK", "departures") for _ in range(callers)),
                return_exceptions=True,
            )
            await provider.entered.wait()
            await _let_tasks_run()
            provider.gate.set()
            return await requests

        results = asyncio.run(scenario())
        assert len(results) == callers
        depths = set()
        for result in results:
            assert isinstance(result, RateLimitError)
            # Nothing is chained onto the exception on its way to a waiter.
            assert result.__cause__ is None
            assert result.__context__ is None
            depths.add(len(traceback.extract_tb(result.__traceback__)))
        assert len(depths) == 1
        return depths.pop()

    assert traceback_depth(CALLERS) == traceback_depth(2)


# --- cancellation -------------------------------------------------------------


@both_paths
def test_cancelling_the_first_caller_leaves_the_fetch_and_the_waiters_alone(
    request_flights: Request,
) -> None:
    async def scenario() -> tuple[GatedProvider, asyncio.Task[Response], list[Response]]:
        provider = GatedProvider()
        service = _make_service(provider)

        # This request is the one whose miss starts the provider call.
        first = asyncio.ensure_future(request_flights(service))
        await provider.entered.wait()
        waiters = _start(request_flights, service, CALLERS - 1)
        await _let_tasks_run()

        first.cancel()
        await _let_tasks_run()
        assert first.cancelled()
        # The call is still in flight and the waiters are still waiting on it.
        assert provider.waiting == 1
        assert not any(waiter.done() for waiter in waiters)

        provider.gate.set()
        responses = await asyncio.gather(*waiters)
        return provider, first, responses

    provider, first, responses = asyncio.run(scenario())

    assert first.cancelled()
    assert len(provider.calls) == 1
    assert len(responses) == CALLERS - 1
    assert all(response.flights == [_make_flight()] for response in responses)
    assert [response.cached for response in responses] == [False] * (CALLERS - 1)


@both_paths
def test_cancelling_a_waiter_leaves_the_fetch_and_the_other_callers_alone(
    request_flights: Request,
) -> None:
    async def scenario() -> tuple[GatedProvider, asyncio.Task[Response], list[Response]]:
        provider = GatedProvider()
        service = _make_service(provider)

        first = asyncio.ensure_future(request_flights(service))
        await provider.entered.wait()
        waiters = _start(request_flights, service, CALLERS - 1)
        await _let_tasks_run()

        gone, *staying = waiters
        gone.cancel()
        await _let_tasks_run()
        assert gone.cancelled()
        assert provider.waiting == 1
        assert not first.done()
        assert not any(waiter.done() for waiter in staying)

        provider.gate.set()
        responses = await asyncio.gather(first, *staying)
        return provider, gone, responses

    provider, gone, responses = asyncio.run(scenario())

    assert gone.cancelled()
    assert len(provider.calls) == 1
    assert len(responses) == CALLERS - 1
    assert all(response.flights == [_make_flight()] for response in responses)


@both_paths
def test_fetch_still_fills_the_cache_when_every_caller_is_cancelled(
    request_flights: Request,
) -> None:
    async def scenario() -> tuple[GatedProvider, Response]:
        provider = GatedProvider()
        service = _make_service(provider, clock=_ticking_clock())

        callers = _start(request_flights, service, CALLERS)
        await provider.entered.wait()
        await _let_tasks_run()
        for caller in callers:
            caller.cancel()
        await _let_tasks_run()
        assert all(caller.cancelled() for caller in callers)
        # Nobody is waiting any more, but the upstream call has been paid for.
        assert provider.waiting == 1

        provider.gate.set()
        await _let_tasks_run()
        assert service._in_flight == {}
        return provider, await request_flights(service)

    provider, response = asyncio.run(scenario())

    assert len(provider.calls) == 1
    assert response.cached is True
    assert response.fetched_at == START


@both_paths
@both_errors
def test_failure_after_every_caller_is_cancelled_is_dropped_quietly(
    request_flights: Request, error: type[ProviderError]
) -> None:
    async def scenario() -> tuple[GatedProvider, int, Response]:
        provider = GatedProvider(error=error)
        cache: TTLCache[FlightSnapshot] = TTLCache(ttl_seconds=CACHE_TTL_SECONDS)
        service = _make_service(provider, cache=cache)

        callers = _start(request_flights, service, CALLERS)
        await provider.entered.wait()
        await _let_tasks_run()
        for caller in callers:
            caller.cancel()
        await _let_tasks_run()

        # The fetch now fails with nobody left to receive the exception. The
        # autouse fixture checks asyncio does not report it as never retrieved.
        provider.gate.set()
        await _let_tasks_run()
        assert service._in_flight == {}
        entries_after_failure = len(cache)

        provider.error = None
        return provider, entries_after_failure, await request_flights(service)

    provider, entries_after_failure, response = asyncio.run(scenario())

    assert entries_after_failure == 0
    assert len(provider.calls) == 2
    assert response.cached is False


@both_paths
def test_cancelled_fetch_is_forgotten_and_does_not_leave_waiters_hanging(
    request_flights: Request,
) -> None:
    async def scenario() -> tuple[GatedProvider, list[Response | BaseException], Response]:
        provider = GatedProvider()
        service = _make_service(provider)

        callers = _start(request_flights, service, CALLERS)
        await provider.entered.wait()
        await _let_tasks_run()

        # Nothing in the service cancels a running fetch; the event loop does
        # when it shuts down. Do the same thing to the fetch directly.
        (fetch,) = service._in_flight.values()
        fetch.cancel()
        results = await asyncio.gather(*callers, return_exceptions=True)
        assert service._in_flight == {}

        provider.gate.set()
        return provider, results, await request_flights(service)

    provider, results, response = asyncio.run(scenario())

    assert [type(result) for result in results] == [asyncio.CancelledError] * CALLERS
    # Nothing was cached, and the next request starts a fetch of its own.
    assert len(provider.calls) == 2
    assert response.cached is False


# --- the in-flight map --------------------------------------------------------


@both_paths
@pytest.mark.parametrize("error", [None, ProviderError, RateLimitError])
def test_in_flight_entry_lasts_only_as_long_as_the_fetch(
    request_flights: Request, error: type[ProviderError] | None
) -> None:
    async def scenario() -> tuple[int, int, int]:
        provider = GatedProvider(error=error)
        service = _make_service(provider)
        before = len(service._in_flight)

        requests = asyncio.gather(
            *(request_flights(service) for _ in range(CALLERS)), return_exceptions=True
        )
        await provider.entered.wait()
        await _let_tasks_run()
        during = len(service._in_flight)

        provider.gate.set()
        await requests
        return before, during, len(service._in_flight)

    # One entry for the key however many requests are waiting, and none once
    # the fetch has finished, whether it succeeded or failed.
    assert asyncio.run(scenario()) == (0, 1, 0)


def test_in_flight_map_is_empty_after_many_keys_have_been_fetched() -> None:
    async def scenario() -> tuple[GatedProvider, int]:
        provider = GatedProvider()
        service = _make_service(provider)
        provider.gate.set()

        airports = [f"A{first}{second}" for first in "ABCDE" for second in "ABCDE"]
        await asyncio.gather(
            *(service.get_flights(airport, "departures") for airport in airports),
            *(service.get_flight_by_number(f"AA{number}") for number in range(25)),
        )
        return provider, len(service._in_flight)

    provider, in_flight = asyncio.run(scenario())

    assert len(provider.calls) == 50
    assert in_flight == 0
