import app from './app';
import logger from './lib/logger';

const port = process.env.PORT || 4000;

app.listen(port, () => {
  logger.info(`Server is running on port ${port} [${process.env.NODE_ENV}]`);
});
