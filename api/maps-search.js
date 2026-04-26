module.exports = async (req, res) => {
  try {
    const key = process.env.SERPAPI_KEY;
    const q = req.query.q || "hotel";

    const url =
      `https://serpapi.com/search.json?engine=google_maps&q=${encodeURIComponent(q)}&api_key=${key}`;

    const response = await fetch(url);
    const data = await response.json();

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
};
