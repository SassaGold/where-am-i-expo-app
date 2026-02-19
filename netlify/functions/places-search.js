const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

exports.handler = async (event, context) => {
  const { query, location, radius, type } = event.queryStringParameters;

  try {
    // Mock data for development/testing
    const mockData = {
      results: [
        {
          name: "Mock Cafe",
          place_id: "mock1",
          geometry: { location: { lat: 40.7128, lng: -74.006 } },
          vicinity: "123 Mock St, Mock City",
          rating: 4.5,
          user_ratings_total: 120,
          types: ["cafe", "food", "point_of_interest", "establishment"],
        },
        {
          name: "Fake Bistro",
          place_id: "mock2",
          geometry: { location: { lat: 40.7138, lng: -74.007 } },
          vicinity: "456 Fake Ave, Mock City",
          rating: 4.2,
          user_ratings_total: 98,
          types: ["restaurant", "food", "point_of_interest", "establishment"],
        },
        {
          name: "Sample Diner",
          place_id: "mock3",
          geometry: { location: { lat: 40.7148, lng: -74.008 } },
          vicinity: "789 Sample Blvd, Mock City",
          rating: 4.0,
          user_ratings_total: 75,
          types: ["diner", "food", "point_of_interest", "establishment"],
        }
      ],
      status: "OK"
    };
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify(mockData),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};