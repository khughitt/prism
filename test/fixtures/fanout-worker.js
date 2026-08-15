import { fanOut } from '../../src/fanout.js';

const [, , sink, param, value] = process.argv;

await fanOut({
  manifests: [{ sink, binds: [{ param, liveness: 'live' }] }],
  resolved: { params: { [param]: Number(value) } },
  changedKeys: [param],
  runner: () => process.send?.('ready'),
});
