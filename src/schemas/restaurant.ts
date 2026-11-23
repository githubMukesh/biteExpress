import { z } from 'zod';

export const restaurantCreateSchema = z.object({
  name: z.string().min(1),
  address: z.object({
    line: z.string().min(1),
    locality: z.string().default(''),
  }),
  city: z.string().min(1),
  countryCode: z.number().int(),
  location: z.object({ lng: z.number(), lat: z.number() }).optional(),
  cuisines: z.array(z.string()).default([]),
  pricing: z
    .object({
      costForTwo: z.number().min(0).default(0),
      currencySourceLabel: z.string().default(''),
    })
    .default({ costForTwo: 0, currencySourceLabel: '' }),
  flags: z
    .object({
      tableBooking: z.boolean().default(false),
      onlineDelivery: z.boolean().default(false),
      deliveringNow: z.boolean().default(false),
      orderMenu: z.boolean().default(false),
    })
    .default({}),
  rating: z
    .object({
      average: z.number().min(0).max(5).default(0),
      votes: z.number().int().min(0).default(0),
    })
    .default({ average: 0, votes: 0 }),
  source: z
    .object({
      system: z.string().default('api'),
      sourceId: z.number().int(),
    })
    .optional(),
});

export type TRestaurantCreate = z.infer<typeof restaurantCreateSchema>;
