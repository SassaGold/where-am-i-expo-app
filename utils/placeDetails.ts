import { Place, Review } from '../types/places';
import { Platform } from 'react-native';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Helper function to detect if we're running on Netlify (production)
const isProduction = (): boolean => {
  if (Platform.OS !== 'web') return false;
  return typeof window !== 'undefined' && window.location.hostname.includes('netlify');
};

// Helper function to map categories to Google Places types
const getGoogleType = (category: string): string | undefined => {
  const categoryMap: { [key: string]: string } = {
    'restaurant': 'restaurant',
    'hotel': 'lodging',
    'attraction': 'tourist_attraction',
    'monument': 'tourist_attraction',
    'castle': 'tourist_attraction',
    'ruins': 'tourist_attraction',
    'memorial': 'tourist_attraction',
    'museum': 'museum',
    'park': 'park',
    'bar': 'bar',
    'cafe': 'cafe',
    'store': 'store',
    'shop': 'store',
    'supermarket': 'supermarket',
    'pharmacy': 'pharmacy',
    'hospital': 'hospital',
    'bank': 'bank',
    'gas_station': 'gas_station',
    'parking': 'parking',
  };

  return categoryMap[category] || undefined;
};

// Google Places API functions
export const searchGooglePlaces = async (query: string, location: { lat: number; lng: number }, radius: number = 5000, type?: string): Promise<any[]> => {
  try {
    // Use Netlify functions for production, local proxy for development, direct API for mobile
    let url;
    if (isProduction()) {
      url = `/.netlify/functions/places-search?` +
        `query=${encodeURIComponent(query)}&` +
        `location=${location.lat},${location.lng}&` +
        `radius=${radius}`;
      if (type) url += `&type=${type}`;
    } else if (Platform.OS === 'web') {
      url = `http://localhost:3001/api/places/nearbysearch?` +
        `location=${location.lat},${location.lng}&` +
        `radius=${radius}&` +
        `keyword=${encodeURIComponent(query)}`;
      if (type) url += `&type=${type}`;
    } else {
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
        `location=${location.lat},${location.lng}&` +
        `radius=${radius}&` +
        `keyword=${encodeURIComponent(query)}&` +
        `key=${GOOGLE_PLACES_API_KEY}`;
      if (type) url += `&type=${type}`;
    }

    console.log('Making API call to:', url.replace(GOOGLE_PLACES_API_KEY, '[API_KEY]'));

    const response = await fetch(url);
    const data = await response.json();
    console.log('API response status:', data.status);

    if (data.status !== 'OK') {
      console.log('Google Places API error:', data.status, data.error_message);
      return [];
    }

    return data.results || [];
  } catch (error) {
    console.log('Error searching Google Places:', error);
    return [];
  }
};

// Search places by category/type using Google Places API
export const searchPlacesByType = async (type: string, location: { lat: number; lng: number }, radius: number = 5000): Promise<any[]> => {
  try {
    const googleType = getGoogleType(type);
    let url;

    if (isProduction()) {
      url = `/.netlify/functions/places-search?` +
        `query=${encodeURIComponent(type)}&` +
        `location=${location.lat},${location.lng}&` +
        `radius=${radius}&` +
        `type=${googleType || type}`;
    } else if (Platform.OS === 'web') {
      url = `http://localhost:3001/api/places/nearbysearch?` +
        `location=${location.lat},${location.lng}&` +
        `radius=${radius}&` +
        `keyword=${encodeURIComponent(type)}`;
      if (googleType) url += `&type=${googleType}`;
    } else {
      url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?` +
        `location=${location.lat},${location.lng}&` +
        `radius=${radius}&` +
        `keyword=${encodeURIComponent(type)}&` +
        `key=${GOOGLE_PLACES_API_KEY}`;
      if (googleType) url += `&type=${googleType}`;
    }

    console.log('Searching places by type:', type, 'Google type:', googleType);

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.log('Google Places API error:', data.status, data.error_message);
      return [];
    }

    return data.results || [];
  } catch (error) {
    console.log('Error searching places by type:', error);
    return [];
  }
};

// Find place by text query for better matching
export const findGooglePlace = async (textQuery: string, location?: { lat: number; lng: number }): Promise<any[]> => {
  try {
    let url;

    if (isProduction()) {
      url = `/.netlify/functions/places-textsearch?` +
        `query=${encodeURIComponent(textQuery)}`;
      if (location) {
        url += `&location=${location.lat},${location.lng}&radius=2000`;
      }
    } else if (Platform.OS === 'web') {
      url = `http://localhost:3001/api/places/textsearch?` +
        `query=${encodeURIComponent(textQuery)}`;
      if (location) {
        url += `&location=${location.lat},${location.lng}&radius=2000`;
      }
    } else {
      url = `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
        `query=${encodeURIComponent(textQuery)}&` +
        `key=${GOOGLE_PLACES_API_KEY}`;
      if (location) {
        url += `&location=${location.lat},${location.lng}&radius=2000`;
      }
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      console.log('Google Text Search API error or no results:', data.status);
      return [];
    }

    return data.results;
  } catch (error) {
    console.log('Error finding Google Place:', error);
    return [];
  }
};

export const getPlaceDetails = async (placeId: string): Promise<any> => {
  try {
    let url;

    if (isProduction()) {
      url = `/.netlify/functions/places-details?` +
        `placeId=${placeId}`;
    } else if (Platform.OS === 'web') {
      url = `http://localhost:3001/api/places/details?` +
        `place_id=${placeId}`;
    } else {
      url = `https://maps.googleapis.com/maps/api/place/details/json?` +
        `place_id=${placeId}&` +
        `fields=name,formatted_address,formatted_phone_number,website,opening_hours,rating,reviews,photos,types&` +
        `key=${GOOGLE_PLACES_API_KEY}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.log('Google Place Details API error:', data.status);
      return null;
    }

    return data.result;
  } catch (error) {
    console.log('Error getting place details:', error);
    return null;
  }
};

export const getPlacePhotos = async (photoReferences: string[]): Promise<string[]> => {
  // Skipping photo loading due to API restrictions
  return [];
};

const generatePlaceDescription = (placeDetails: any, originalPlace: Place): string => {
  const types = placeDetails.types || [];
  const rating = placeDetails.rating;
  const name = placeDetails.name || originalPlace.name;
  const category = originalPlace.category;

  let description = `${name} is a ${category}`;

  // Add rating if available
  if (rating) {
    description += ` with a ${rating}-star rating`;
  }

  // Add type-based descriptions
  if (types.includes('restaurant')) {
    description += ', offering delicious cuisine';
  } else if (types.includes('hotel')) {
    description += ', providing comfortable accommodations';
  } else if (types.includes('tourist_attraction') || types.includes('museum') || types.includes('park')) {
    description += ', a popular destination for visitors';
  } else if (types.includes('store') || types.includes('shopping_mall')) {
    description += ', featuring a variety of products and services';
  }

  // Add location context
  if (placeDetails.formatted_address) {
    description += ` located at ${placeDetails.formatted_address}`;
  }

  description += '.';

  return description;
};

export const enhancePlaceWithDetails = async (place: Place): Promise<Place> => {
  try {
    // Get Google type for better matching
    const googleType = getGoogleType(place.category);

    // First, try to find the exact place by text query
    const textQuery = place.name;

    const foundPlaces = await findGooglePlace(textQuery, { lat: place.latitude, lng: place.longitude });

    let placeId: string | null = null;

    console.log('Text search results for', textQuery, ':', foundPlaces.length);

    if (foundPlaces.length > 0) {
      // Sort by distance
      const sortedResults = foundPlaces.sort((a, b) => {
        if (a.geometry && b.geometry) {
          const distA = Math.abs(a.geometry.location.lat - place.latitude) + Math.abs(a.geometry.location.lng - place.longitude);
          const distB = Math.abs(b.geometry.location.lat - place.latitude) + Math.abs(b.geometry.location.lng - place.longitude);
          return distA - distB;
        }
        return 0;
      });

      // Take the closest result
      const closestPlace = sortedResults[0];
      console.log('Closest place:', closestPlace.name, closestPlace.place_id);
      placeId = closestPlace.place_id;
    }

    // If not found or type doesn't match, fall back to nearby search
    if (!placeId) {
      const googlePlaces = await searchGooglePlaces(
        place.name,
        { lat: place.latitude, lng: place.longitude },
        2000, // Increased radius for better accuracy
        undefined // Don't filter by type in nearby search
      );

      console.log('Nearby search results for', place.name, ':', googlePlaces.length);

      if (googlePlaces.length > 0) {
        // Sort by distance
        const sortedPlaces = googlePlaces.sort((a, b) => {
          if (a.geometry && b.geometry) {
            const distA = Math.abs(a.geometry.location.lat - place.latitude) + Math.abs(a.geometry.location.lng - place.longitude);
            const distB = Math.abs(b.geometry.location.lat - place.latitude) + Math.abs(b.geometry.location.lng - place.longitude);
            return distA - distB;
          }
          return 0;
        });

        const closestPlace = sortedPlaces[0];
        console.log('Closest nearby place:', closestPlace.name, closestPlace.place_id);
        placeId = closestPlace.place_id;
      }
    }

    if (placeId) {
      console.log('Using placeId:', placeId);
      // Get detailed information
      const placeDetails = await getPlaceDetails(placeId);

      if (placeDetails) {
        // Get photos
        const photos = placeDetails.photos ?
          await getPlacePhotos(placeDetails.photos.map((p: any) => p.photo_reference)) :
          [];

        // Convert Google reviews to our format
        const reviews: Review[] = placeDetails.reviews ?
          placeDetails.reviews.slice(0, 3).map((review: any, index: number) => ({
            id: `google_${index}`,
            author: review.author_name,
            rating: review.rating,
            text: review.text,
            date: new Date(review.time * 1000).toISOString().split('T')[0],
          })) : [];

        // Generate enhanced description
        const enhancedDescription = place.description || generatePlaceDescription(placeDetails, place);

        return {
          ...place,
          phone: placeDetails.formatted_phone_number || place.phone,
          website: placeDetails.website || place.website,
          openingHours: placeDetails.opening_hours?.weekday_text?.join('\n') || place.openingHours,
          address: placeDetails.formatted_address || place.address,
          description: enhancedDescription,
          photos,
          reviews,
        };
      }
    }

    // Fallback to mock data if Google Places fails
    console.log('Falling back to mock data for', place.name);
    const mockReviews: Place['reviews'] = [
      {
        id: '1',
        author: 'John Rider',
        rating: 4,
        text: 'Great place for motorcyclists! Highly recommend.',
        date: new Date().toISOString().split('T')[0],
      },
      {
        id: '2',
        author: 'Sarah Moto',
        rating: 5,
        text: 'Amazing experience. The staff was very friendly.',
        date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      },
    ];

    return {
      ...place,
      photos: [],
      reviews: mockReviews,
      phone: place.phone || '+1-555-0123',
      website: place.website || `https://example.com/${place.name.toLowerCase().replace(/\s+/g, '-')}`,
      openingHours: place.openingHours || 'Mon-Fri: 9AM-6PM, Sat: 10AM-4PM, Sun: Closed',
      address: place.address || '123 Main St, City, State 12345',
      description: place.description || `A wonderful ${place.category} destination perfect for motorcycle enthusiasts.`,
    };
  } catch (error) {
    console.log('Error enhancing place with details:', error);

    // Return place with minimal enhancements if everything fails
    return {
      ...place,
      photos: [],
      reviews: [],
    };
  }
};