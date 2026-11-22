import { toPublicId, type IRestaurantDoc } from '../domain/restaurant.js';
import type { TListResultDoc } from '../repositories/restaurantRepo.js';

export function toRestaurant(doc: IRestaurantDoc) {
  return {
    id: toPublicId(doc.source.system, doc.source.sourceId),
    name: doc.name,
    address: doc.address,
    city: doc.city,
    country: doc.country,
    countryCode: doc.countryCode,
    location: doc.location
      ? { lng: doc.location.coordinates[0], lat: doc.location.coordinates[1] }
      : null,
    cuisines: doc.cuisines,
    pricing: {
      costForTwo: doc.pricing.costForTwo,
      currencyCode: doc.pricing.currencyCode,
      currencySourceLabel: doc.pricing.currencySourceLabel,
      currencyAnomaly: doc.pricing.currencyAnomaly,
      priceAvailable: doc.pricing.priceAvailable,
    },
    flags: doc.flags,
    rating: {
      average: doc.rating.average,
      votes: doc.rating.votes,
      available: doc.rating.ratingAvailable,
      weighted: doc.rating.weighted,
    },
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

// List item with the brief's required attributes. distanceKm only when a
// coordinate origin was supplied; averageRating is null for unrated records.
export function toListItem(doc: TListResultDoc) {
  return {
    id: toPublicId(doc.source.system, doc.source.sourceId),
    name: doc.name,
    address: doc.address.line,
    city: doc.city,
    country: doc.country,
    cuisines: doc.cuisines,
    averageRating: doc.rating.ratingAvailable ? doc.rating.average : null,
    ...(doc.distanceMeters !== undefined
      ? { distanceKm: Math.round((doc.distanceMeters / 1000) * 100) / 100 }
      : {}),
  };
}
