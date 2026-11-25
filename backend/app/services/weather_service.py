from collections.abc import Callable
from datetime import datetime, timezone
from typing import Protocol

from app.core.airport_codes import icao_for_iata
from app.core.cache import TTLCache
from app.models.weather import Weather, WeatherResponse, WeatherSnapshot


class MetarSource(Protocol):
    async def get_metar(self, icao: str) -> Weather | None: ...


class UnknownAirportError(Exception):
    """The IATA code isn't in the airport table, so there is no station to ask."""


class NoWeatherReportError(Exception):
    """The airport's station has no current report."""


class WeatherService:
    """Serves the current METAR for an airport, by IATA code, through a TTL cache.

    Airports report about once an hour, so a cache of several minutes costs
    almost nothing in freshness. A station with no report is remembered for
    the same time, so asking again doesn't call upstream each time.
    """

    def __init__(
        self,
        source: MetarSource,
        reports: TTLCache[WeatherSnapshot],
        no_report: TTLCache[bool],
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._source = source
        self._reports = reports
        self._no_report = no_report
        self._clock = clock

    async def get_weather(self, airport: str) -> WeatherResponse:
        iata = airport.strip().upper()
        icao = icao_for_iata(iata)
        if icao is None:
            raise UnknownAirportError(iata)

        snapshot = self._reports.get(icao)
        cached = snapshot is not None
        if snapshot is None:
            if self._no_report.get(icao):
                raise NoWeatherReportError(iata)
            weather = await self._source.get_metar(icao)
            if weather is None:
                self._no_report.set(icao, True)
                raise NoWeatherReportError(iata)
            snapshot = WeatherSnapshot(weather=weather, fetched_at=self._now())
            self._reports.set(icao, snapshot)

        return WeatherResponse(
            airport=iata,
            fetched_at=snapshot.fetched_at,
            cached=cached,
            weather=snapshot.weather,
        )

    def _now(self) -> datetime:
        return self._clock() if self._clock is not None else datetime.now(timezone.utc)
