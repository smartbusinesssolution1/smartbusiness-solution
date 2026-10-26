// Runs before every test file, ahead of any application import.
import { applyTestEnv } from "./test-env.js";
import "./keep-alive.js";

applyTestEnv();
