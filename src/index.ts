import Koa from 'koa';
import bodyParser from '@koa/bodyparser';
import router from './routes';
import './config'; // Ensure config is initialized

const app = new Koa();

app
  .use(bodyParser())
  .use(router.routes())
  .use(router.allowedMethods())
  .listen(7988, () => {
    console.log('Server running on port 7988');
  });
