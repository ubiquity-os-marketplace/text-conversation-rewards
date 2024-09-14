// cSpell:disable
import { factory, primaryKey } from "@mswjs/data";

/**
 * Creates an object that can be used as a db to persist data within tests
 */
export const db = factory({
  users: {
    id: primaryKey(Number),
    login: String,
  },
  wallets: {
    id: primaryKey(Number),
    userId: Number,
    address: String,
  },
  locations: {
    id: primaryKey(Number),
    issue_id: Number,
    node_url: String,
    node_type: String,
    repository_id: Number,
  },
  permits: {
    id: primaryKey(Number),
    amount: String,
    nonce: String,
    deadline: String,
    signature: String,
    beneficiary_id: Number,
    location_id: Number,
  },
});
