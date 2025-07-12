function Filter() {
    return (
        <form>
            <label>
                Flight Number:
                <input type="text" name="flightNumber" />
                
            </label>
            <label>
                Airline:
                <input type="text" name="airline" />
            </label>
            <label>
                Departure Airport:
                <input type="text" name="departureAirport" />
            </label>
            <label>
                Arrival Airport:
                <input type="text" name="arrivalAirport" />
            </label>
            <button type="submit">Search</button>
            <button type="reset">Reset</button>
            <button type="button" onClick={() => alert('Filter applied!')}>Apply Filter</button>
            <button type="button" onClick={() => alert('Filter cleared!')}>Clear Filter</button>
        </form>
    );  
}
export default Filter;