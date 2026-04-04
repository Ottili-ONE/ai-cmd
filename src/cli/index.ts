#!/usr/bin/env node

import { runCliAndHandleErrors } from "./commands.js";

await runCliAndHandleErrors(process.argv);
