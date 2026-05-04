const createGameId = () => Math.random().toString(36).slice(2, 8)

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  return res.status(200).json({ gameId: createGameId() })
}
