import { Router } from 'express';
import { restaurantCreateSchema } from '../../schemas/restaurant.js';
import { toRestaurant } from '../../http/responses.js';
import { toPublicId } from '../../domain/restaurant.js';
import { ROUTES } from '../paths.js';
import type { RestaurantService } from '../../services/restaurantService.js';

export function restaurantsRouter(service: RestaurantService): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const input = restaurantCreateSchema.parse(req.body);
    const doc = await service.create(input);
    const publicId = toPublicId(doc.source.system, doc.source.sourceId);
    res.status(201).location(`${ROUTES.restaurants}/${publicId}`).json(toRestaurant(doc));
  });

  router.get('/:id', async (req, res) => {
    const doc = await service.getById(req.params.id);
    res.json(toRestaurant(doc));
  });

  return router;
}
