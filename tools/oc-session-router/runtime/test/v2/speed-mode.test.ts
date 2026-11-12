import test from "node:test";
import assert from "node:assert/strict";
import { speedMode, speedModel } from "../../src/v2/speed-mode.js";
test("speed mode defaults Standard and rejects unknown policy", () => {
 assert.equal(speedMode(undefined), "standard");
 for(const bad of [null, "auto", "ultrafast", {}, 1]) assert.throws(()=>speedMode(bad));
});
test("speed aliases preserve base model and reverse without suffix accumulation", () => {
 for(const m of ["gpt-6.1-sol","gpt-6.1-terra","gpt-6-luna"]){
 const base="openai/"+m;
 assert.equal(speedModel(base,"fast"),base+"-fast");
 assert.equal(speedModel(base+"-fast","fast"),base+"-fast");
 assert.equal(speedModel(base+"-fast","standard"),base);
 }
});
test("unsupported fast fails rather than silently changing model families", () => {
 assert.throws(()=>speedModel("other/model","fast"));
 assert.throws(()=>speedModel("openai/gpt-6.1-sol-ultrafast","fast"));
 assert.equal(speedModel("other/model",undefined),"other/model");
});
