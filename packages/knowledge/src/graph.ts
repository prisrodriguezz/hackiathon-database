import neo4j, { type Driver } from 'neo4j-driver';

let driver: Driver | undefined;

export function getGraphDriver(): Driver {
  if (driver) return driver;
  const uri = process.env.NEO4J_URI;
  if (!uri) {
    throw new Error('NEO4J_URI no está configurado.');
  }
  driver = neo4j.driver(
    uri,
    neo4j.auth.basic(process.env.NEO4J_USER ?? 'neo4j', process.env.NEO4J_PASSWORD ?? 'neo4j'),
  );
  return driver;
}

export async function closeGraph(): Promise<void> {
  if (driver) {
    await driver.close();
    driver = undefined;
  }
}
