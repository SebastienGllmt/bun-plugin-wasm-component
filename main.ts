import { add } from "./sstream-components/adder.wasm";

console.log(add);

console.log("1 + 2 = " + add.add(1, 2));