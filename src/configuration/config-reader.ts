import * as fs from "fs";
import YAML from "yaml";
import program from "../parser/command-line";

const file = fs.readFileSync(program.opts().config, "utf8");
const configuration = YAML.parse(file);

export default configuration;
