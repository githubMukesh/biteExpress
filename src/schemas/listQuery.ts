import { z } from 'zod';

export const listQuerySchema = z
  .object({
    name: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    cuisines: z.string().min(1).optional(),
    cuisine_match: z.enum(['any', 'all']).default('any'),
    min_rating: z.coerce.number().min(0).max(5).optional(),
    max_cost_for_two: z.coerce.number().min(0).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lng: z.coerce.number().min(-180).max(180).optional(),
    radius_km: z.coerce.number().positive().optional(),
    sort: z.enum(['distance', 'rating', 'name', 'cost']).optional(),
    order: z.enum(['asc', 'desc']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .refine((d) => (d.lat === undefined) === (d.lng === undefined), {
    message: 'lat and lng must be provided together',
    path: ['lat'],
  })
  .refine((d) => !(d.sort === 'distance' && d.lat === undefined), {
    message: 'sort=distance requires lat and lng',
    path: ['sort'],
  })
  .refine((d) => !(d.radius_km !== undefined && d.lat === undefined), {
    message: 'radius_km requires lat and lng',
    path: ['radius_km'],
  });

export type TListQuery = z.infer<typeof listQuerySchema>;
