// Accès à l'API publique de chess.com (https://www.chess.com/news/view/published-data-api).
const API = 'https://api.chess.com/pub';

async function getJson(url) {
  const res = await fetch(url);
  if (res.status === 404) throw new Error('Joueur introuvable sur chess.com.');
  if (res.status === 429) throw new Error('chess.com limite le nombre de requêtes : réessayez dans une minute.');
  if (!res.ok) throw new Error(`Erreur chess.com (${res.status}).`);
  return res.json();
}

export async function fetchProfile(username) {
  return getJson(`${API}/player/${encodeURIComponent(username.toLowerCase())}`);
}

// Récupère les parties des `months` derniers mois, de la plus récente à la plus ancienne.
export async function fetchGames(username, { months = 3, maxGames = 300, filter = () => true, onProgress } = {}) {
  const { archives } = await getJson(`${API}/player/${encodeURIComponent(username.toLowerCase())}/games/archives`);
  const recent = archives.slice(-months).reverse();
  const games = [];
  for (let i = 0; i < recent.length; i++) {
    if (onProgress) onProgress(i + 1, recent.length);
    const { games: monthGames } = await getJson(recent[i]);
    games.push(...monthGames.reverse().filter(filter));
    if (games.length >= maxGames) break;
  }
  return games.slice(0, maxGames);
}
