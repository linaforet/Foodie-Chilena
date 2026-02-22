import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";

const db = new Database("recipes.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT,
    recipe_name TEXT,
    recipe_data TEXT,
    filters TEXT
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get("/api/meal-plans", (req, res) => {
    const rows = db.prepare("SELECT * FROM meal_plans ORDER BY date ASC").all();
    res.json(rows.map(row => ({
      ...row,
      recipe_data: JSON.parse(row.recipe_data as string),
      filters: JSON.parse(row.filters as string)
    })));
  });

  app.post("/api/meal-plans", (req, res) => {
    const { date, recipe_name, recipe_data, filters } = req.body;
    const info = db.prepare(
      "INSERT INTO meal_plans (date, recipe_name, recipe_data, filters) VALUES (?, ?, ?, ?)"
    ).run(date, recipe_name, JSON.stringify(recipe_data), JSON.stringify(filters));
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/meal-plans/:id", (req, res) => {
    db.prepare("DELETE FROM meal_plans WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
