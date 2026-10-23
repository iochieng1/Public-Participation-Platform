import { Router, urlencoded, type Request } from 'express';
import { config } from '../config.js';
import { h, HttpError } from '../errors.js';
import { handleInboundSms, handleUssd } from '../services/channels.js';

// Africa's Talking does not sign callbacks, so the callback URLs carry a shared
// secret (?token=...). In production also restrict these routes to AT's IP ranges.
export const callbacksRouter = Router();
callbacksRouter.use('/callbacks', urlencoded({ extended: false }));

function checkToken(req: Request) {
  if (req.query.token !== config.callbackToken) throw new HttpError(403, 'Forbidden');
}

callbacksRouter.post(
  '/callbacks/ussd',
  h(async (req, res) => {
    checkToken(req);
    const reply = await handleUssd(String(req.body.phoneNumber ?? ''), String(req.body.text ?? ''));
    res.type('text/plain').send(reply);
  }),
);

callbacksRouter.post(
  '/callbacks/sms',
  h(async (req, res) => {
    checkToken(req);
    await handleInboundSms(String(req.body.from ?? ''), String(req.body.text ?? ''));
    res.sendStatus(200);
  }),
);
