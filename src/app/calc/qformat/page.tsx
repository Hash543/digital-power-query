"use client";

import { useState } from "react";
import { T } from "@/components/lang";
import { Card, ErrorText, Field, PageHeader, Results, Select, TextInput, attempt, fmt, parseNum } from "@/components/ui";
import { fromQHex, toQ, type QSpec } from "@/lib/calc/qformat";

const presets: Record<string, QSpec> = {
  "Q15 (16-bit)": { m: 0, n: 15, signed: true },
  "Q31 (32-bit)": { m: 0, n: 31, signed: true },
  "Q1.14 (16-bit)": { m: 1, n: 14, signed: true },
  "Q7.24 / IQ24 (32-bit)": { m: 7, n: 24, signed: true },
  "Q3.12 (16-bit)": { m: 3, n: 12, signed: true },
  "UQ0.16 (16-bit)": { m: 0, n: 16, signed: false },
};

export default function QFormatPage() {
  const [spec, setSpec] = useState<QSpec>(presets["Q15 (16-bit)"]);
  const [dir, setDir] = useState<"encode" | "decode">("encode");
  const [val, setVal] = useState("0.7071");
  const [hexIn, setHexIn] = useState("0x5A82");

  const r = attempt(() => (dir === "encode" ? toQ(parseNum(val), spec) : fromQHex(hexIn, spec)));
  const name = `${spec.signed ? "" : "U"}Q${spec.m}.${spec.n}`;

  return (
    <div>
      <PageHeader
        title={<T en="Fixed-point Q format" zh="定點 Q 格式" />}
        intro={
          <T
            en="Signed Qm.n uses 1 sign bit + m integer bits + n fractional bits (two's complement). Values are rounded to nearest and saturated."
            zh="有號 Qm.n 由 1 個符號位元 + m 個整數位元 + n 個小數位元組成（二補數）。數值以四捨五入並做飽和處理。"
          />
        }
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title={<T en="Input" zh="輸入" />}>
          <div className="space-y-3">
            <Field label={<T en="Preset" zh="預設格式" />}>
              <Select
                value=""
                onChange={(e) => e.target.value && setSpec(presets[e.target.value])}
              >
                <option value="">—</option>
                {Object.keys(presets).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </Select>
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label={<T en="m (integer bits)" zh="m（整數位元）" />}>
                <TextInput type="number" min={0} value={spec.m} onChange={(e) => setSpec({ ...spec, m: +e.target.value })} />
              </Field>
              <Field label={<T en="n (fraction bits)" zh="n（小數位元）" />}>
                <TextInput type="number" min={0} value={spec.n} onChange={(e) => setSpec({ ...spec, n: +e.target.value })} />
              </Field>
              <Field label={<T en="Sign" zh="符號" />}>
                <Select value={spec.signed ? "s" : "u"} onChange={(e) => setSpec({ ...spec, signed: e.target.value === "s" })}>
                  <option value="s">signed</option>
                  <option value="u">unsigned</option>
                </Select>
              </Field>
            </div>
            <Field label={<T en="Direction" zh="方向" />}>
              <Select value={dir} onChange={(e) => setDir(e.target.value as "encode" | "decode")}>
                <option value="encode">Real → hex</option>
                <option value="decode">Hex → real</option>
              </Select>
            </Field>
            {dir === "encode" ? (
              <Field label={<T en="Real value" zh="實數值" />}>
                <TextInput value={val} onChange={(e) => setVal(e.target.value)} />
              </Field>
            ) : (
              <Field label="Hex">
                <TextInput value={hexIn} onChange={(e) => setHexIn(e.target.value)} />
              </Field>
            )}
          </div>
        </Card>
        <Card title={<T en={`Result · ${name}`} zh={`結果 · ${name}`} />}>
          {r.ok ? (
            <div className="space-y-3">
              {r.value.saturated && (
                <ErrorText>
                  <T en="Value out of range — saturated." zh="數值超出範圍，已飽和。" />
                </ErrorText>
              )}
              <Results
                rows={[
                  [<T key="w" en="Word length" zh="字組長度" />, `${r.value.wordBits} bits`],
                  [<T key="r" en="Resolution" zh="解析度" />, `2^−${spec.n} = ${fmt(r.value.resolution, 6)}`],
                  [<T key="rg" en="Range" zh="範圍" />, `${fmt(r.value.min, 8)} … ${fmt(r.value.max, 8)}`],
                  ["Hex", r.value.hex],
                  ["Binary", r.value.binary.replace(/(.{4})(?=.)/g, "$1 ")],
                  [<T key="i" en="Integer" zh="整數" />, r.value.integer],
                  [<T key="v" en="Represented value" zh="實際表示值" />, fmt(r.value.value, 12)],
                  ...(dir === "encode" ? [[<T key="e" en="Quantization error" zh="量化誤差" />, fmt(r.value.error, 4)] as [React.ReactNode, React.ReactNode]] : []),
                ]}
              />
            </div>
          ) : (
            <ErrorText>{r.error}</ErrorText>
          )}
        </Card>
      </div>
    </div>
  );
}
