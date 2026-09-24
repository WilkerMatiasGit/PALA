export const PORT = Number(process.env.PORT) || 4000;
export const JWT_SECRET = process.env.JWT_SECRET || 'dlab-dev-secret-change-in-production';
export const JWT_EXPIRES_IN = '12h';

// Origens permitidas para CORS (além dos defaults dev/produção). Ex.: "https://app.exemplo.com,https://admin.exemplo.com"
export const CORS_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
