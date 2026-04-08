// Custom Next.js server — desactiva requestTimeout para soportar consultas largas (>5min)
// Usar: node server.js  (en lugar de next dev)
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev  = process.env.NODE_ENV !== 'production';
const port = parseInt(process.env.PORT || '3001', 10);

const app    = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('server error:', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  // Sin timeout en requestTimeout — las consultas al hospital pueden tardar >5 minutos.
  // El default de Node.js (300s) cortaba la conexión antes de que el backend terminara.
  httpServer.requestTimeout = 0;

  httpServer.listen(port, () => {
    console.log(`> Sottano360 frontend listo en http://localhost:${port} [requestTimeout=0]`);
  });
});
