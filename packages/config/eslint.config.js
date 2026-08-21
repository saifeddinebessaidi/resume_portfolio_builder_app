// This package lints itself with the base config it exports — the cheapest way to catch a
// broken shared config before two apps inherit it.
import base from "./eslint/base.js";

export default base;
