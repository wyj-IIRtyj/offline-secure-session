import { createSessionController } from './session-controller.mjs';

const controller = createSessionController();

self.onmessage = async (event) => {
  const { id, action, payload = {} } = event.data ?? {};
  try {
    const result = await controller.handle(action, payload);
    self.postMessage({ id, ok: true, result });
  } catch (error) {
    self.postMessage({ id, ok: false, error: error?.message || '操作失败' });
  }
};
