import { MongoClient, ServerApiVersion } from "mongodb";

const uri = "mongodb+srv://ankitjha:WI9pgQy4AuZmMTMa@cluster0.a1is01y.mongodb.net/?appName=Cluster0";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

try {
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  console.log("✅ Connected successfully!");
} catch (err) {
  console.error(err);
} finally {
  await client.close();
}