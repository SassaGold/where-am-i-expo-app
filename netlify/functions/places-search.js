const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

exports.handler = async (event, context) => {
  const { query, location, radius, type } = event.queryStringParameters;

  try {
    let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
      `location=${location}&` +
      `radius=${radius}&` +
      `keyword=${encodeURIComponent(query)}&` +
      `key=${GOOGLE_PLACES_API_KEY}`;

    if (type) {
      url += `&type=${type}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};