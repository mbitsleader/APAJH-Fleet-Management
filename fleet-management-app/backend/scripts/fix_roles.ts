import pg from 'pg';
import 'dotenv/config';

async function manualMigration() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  console.log('🚀 Démarrage de la migration manuelle des types...');

  try {
    // 1. Ajouter les nouvelles valeurs à l'enum si elles n'existent pas
    // Note: On utilise des requêtes simples car ADD VALUE ne peut pas être dans une transaction
    try {
      await client.query("ALTER TYPE \"Role\" ADD VALUE 'PROFESSIONNEL'");
      console.log("✅ Valeur 'PROFESSIONNEL' ajoutée à l'enum Role.");
    } catch (e: any) {
      if (e.code === '42710') console.log("ℹ️ Valeur 'PROFESSIONNEL' déjà présente.");
      else throw e;
    }

    try {
      await client.query("ALTER TYPE \"Role\" ADD VALUE 'DIRECTEUR'");
      console.log("✅ Valeur 'DIRECTEUR' ajoutée à l'enum Role.");
    } catch (e: any) {
      if (e.code === '42710') console.log("ℹ️ Valeur 'DIRECTEUR' déjà présente.");
      else throw e;
    }

    // 2. Mettre à jour les utilisateurs ayant le rôle 'USER'
    const updateResult = await client.query("UPDATE \"User\" SET role = 'PROFESSIONNEL' WHERE role::text = 'USER'");
    console.log(`✅ ${updateResult.rowCount} utilisateur(s) migré(s) vers 'PROFESSIONNEL'.`);

    // 3. Mettre à jour la valeur par défaut de la colonne
    await client.query("ALTER TABLE \"User\" ALTER COLUMN role SET DEFAULT 'PROFESSIONNEL'");
    console.log("✅ Valeur par défaut de la colonne 'role' mise à jour.");

  } catch (error) {
    console.error('❌ Erreur lors de la migration :', error);
  } finally {
    client.release();
    await pool.end();
  }
}

manualMigration();
