# Train + Hotel itinerary update

## What changed

The itinerary response now includes first-class `trains` and `hotels` arrays.

### Trains
Each option includes:
- trainNumber
- trainName
- from / to
- departure / arrival / duration
- class
- estimatedFarePerPerson
- estimatedTotalFare
- availability
- bookingDetails (provider, booking method, booking URL, booking status)
- dataType

### Hotels
Each option includes:
- name / area / category / rating
- checkIn / checkOut / nights / rooms
- pricePerNight / estimatedTotal
- amenities / nearAttractions
- availability
- bookingDetails (provider, alternative providers, booking method, booking URL, booking status)
- dataType

## Important

The current backend has no live train or hotel inventory API. Therefore these are explicitly `ESTIMATED` and availability is `CHECK_ON_BOOKING`.
The generated booking URLs are provider entry pages, not fake item-specific booking confirmations.

## Files changed

- `src/main/java/com/naavi/ai/ItineraryGenerator.java`
- `src/main/java/com/naavi/service/ItineraryValidator.java`
- `src/main/java/com/naavi/service/NoLiveTravelDataProvider.java`
- `src/main/java/com/naavi/service/ItineraryService.java`

## Expected response shape

```json
{
  "transportation": [],
  "trains": [
    {
      "trainNumber": "...",
      "trainName": "...",
      "estimatedFarePerPerson": 850,
      "estimatedTotalFare": 1700,
      "availability": "CHECK_ON_BOOKING",
      "bookingDetails": {
        "provider": "IRCTC",
        "bookingStatus": "NOT_LIVE",
        "bookingUrl": "https://www.irctc.co.in/nget/train-search"
      },
      "dataType": "ESTIMATED"
    }
  ],
  "accommodation": [],
  "hotels": [
    {
      "name": "...",
      "pricePerNight": 2800,
      "estimatedTotal": 5600,
      "availability": "CHECK_ON_BOOKING",
      "bookingDetails": {
        "provider": "Booking.com",
        "bookingStatus": "NOT_LIVE",
        "bookingUrl": "https://www.booking.com/"
      },
      "dataType": "ESTIMATED"
    }
  ]
}
```
