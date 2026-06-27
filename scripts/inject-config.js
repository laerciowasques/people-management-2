/**
 * Injeta variáveis de ambiente do Vercel em supabase-config.js no build
 */
const fs = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_ANON_KEY || '';

const content = `// Gerado automaticamente no deploy Vercel — não editar manualmente
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`;

const out = path.join(__dirname, '..', 'supabase-config.js');
fs.writeFileSync(out, content, 'utf8');

if (!url || !key) {
  console.warn('AVISO: SUPABASE_URL ou SUPABASE_ANON_KEY não definidos no Vercel.');
} else {
  console.log('supabase-config.js gerado com sucesso.');
}
