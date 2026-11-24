"use client";

import { useState } from "react";
import { T } from "@/components/lang";
import { Card, ErrorText, Field, PageHeader, Results, Select, Tabs, TextInput, attempt, fmt, parseNum } from "@/components/ui";
import * as pm from "@/lib/calc/pmbus";

type Dir = "decode" | "encode";

function DirSelect({ dir, setDir }: { dir: Dir; setDir: (d: Dir) => void }) {
  return (
    <Field label={<T en="Direction" zh="方向" />}>
      <Select value={dir} onChange={(e) => setDir(e.target.value as Dir)}>
        <option value="decode">Hex → value</option>
        <option value="encode">Value → hex</option>
      </Select>
    </Field>
  );
}

function Linear11() {
  const [dir, setDir] = useState<Dir>("decode");
  const [hexIn, setHexIn] = useState("0xD300");
  const [val, setVal] = useState("12");
  const [exp, setExp] = useState("");
  const r = attempt(() =>
    dir === "decode"
      ? pm.decodeLinear11(pm.parseHex(hexIn))
      : pm.encodeLinear11(parseNum(val), exp.trim() === "" ? undefined : parseInt(exp)),
  );
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-3">
        <DirSelect dir={dir} setDir={setDir} />
        {dir === "decode" ? (
          <Field label="LINEAR11 word (hex)">
            <TextInput value={hexIn} onChange={(e) => setHexIn(e.target.value)} />
          </Field>
        ) : (
          <>
            <Field label={<T en="Value" zh="數值" />}>
              <TextInput value={val} onChange={(e) => setVal(e.target.value)} />
            </Field>
            <Field
              label={<T en="Exponent N (optional)" zh="指數 N（選填）" />}
              hint={<T en="Blank = finest resolution that fits" zh="留白 = 自動選擇可容納的最細解析度" />}
            >
              <TextInput value={exp} onChange={(e) => setExp(e.target.value)} placeholder="auto" />
            </Field>
          </>
        )}
      </div>
      <div>
        {r.ok ? (
          <Results
            rows={[
              ["Word", r.value.hex],
              ["Bits", r.value.word.toString(2).padStart(16, "0").replace(/^(.{5})/, "$1 ")],
              ["N (exponent)", r.value.exponent],
              ["Y (mantissa)", r.value.mantissa],
              [<T key="v" en="Value" zh="數值" />, fmt(r.value.value, 10)],
              [<T key="l" en="LSB" zh="LSB" />, fmt(2 ** r.value.exponent, 10)],
              ...(r.value.error !== undefined ? [[<T key="e" en="Rounding error" zh="捨入誤差" />, fmt(r.value.error, 4)] as [React.ReactNode, React.ReactNode]] : []),
            ]}
          />
        ) : (
          <ErrorText>{r.error}</ErrorText>
        )}
      </div>
    </div>
  );
}

function Linear16() {
  const [dir, setDir] = useState<Dir>("decode");
  const [mode, setMode] = useState("0x17");
  const [hexIn, setHexIn] = useState("0x0266");
  const [val, setVal] = useState("1.2");
  const r = attempt(() => {
    const vm = pm.decodeVoutMode(pm.parseHex(mode));
    if (vm.mode !== "linear") throw new Error(`VOUT_MODE ${vm.hex} is ${vm.mode} mode, not linear`);
    const data = dir === "decode" ? pm.decodeLinear16(pm.parseHex(hexIn), vm.exponent!) : pm.encodeLinear16(parseNum(val), vm.exponent!);
    return { vm, data };
  });
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-3">
        <Field label="VOUT_MODE (hex)" hint={<T en="e.g. 0x17 → N = −9" zh="例如 0x17 → N = −9" />}>
          <TextInput value={mode} onChange={(e) => setMode(e.target.value)} />
        </Field>
        <DirSelect dir={dir} setDir={setDir} />
        {dir === "decode" ? (
          <Field label="LINEAR16 word (hex)">
            <TextInput value={hexIn} onChange={(e) => setHexIn(e.target.value)} />
          </Field>
        ) : (
          <Field label={<T en="Voltage (V)" zh="電壓 (V)" />}>
            <TextInput value={val} onChange={(e) => setVal(e.target.value)} />
          </Field>
        )}
      </div>
      <div>
        {r.ok ? (
          <Results
            rows={[
              ["VOUT_MODE", `${r.value.vm.hex} · mode ${r.value.vm.modeBits.toString(2).padStart(3, "0")} (${r.value.vm.mode})`],
              ["N (exponent)", r.value.vm.exponent],
              ["Word", r.value.data.hex],
              [<T key="v" en="Voltage" zh="電壓" />, `${fmt(r.value.data.value, 10)} V`],
              ["LSB", `${fmt(r.value.data.lsb * 1000, 6)} mV`],
              [<T key="m" en="Max" zh="最大值" />, `${fmt(0xffff * r.value.data.lsb, 6)} V`],
              ...(r.value.data.error !== undefined ? [[<T key="e" en="Rounding error" zh="捨入誤差" />, `${fmt(r.value.data.error * 1000, 4)} mV`] as [React.ReactNode, React.ReactNode]] : []),
            ]}
          />
        ) : (
          <ErrorText>{r.error}</ErrorText>
        )}
      </div>
    </div>
  );
}

function Direct() {
  const [dir, setDir] = useState<Dir>("decode");
  const [m, setM] = useState("100");
  const [b, setB] = useState("0");
  const [R, setR] = useState("0");
  const [hexIn, setHexIn] = useState("0x04D2");
  const [val, setVal] = useState("12.34");
  const r = attempt(() => {
    const c = { m: parseNum(m), b: parseNum(b), R: parseInt(R) };
    if ([c.m, c.b, c.R].some((x) => !Number.isFinite(x))) throw new Error("Invalid coefficient");
    return dir === "decode" ? pm.decodeDirect(pm.parseHex(hexIn), c) : pm.encodeDirect(parseNum(val), c);
  });
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <Field label="m">
            <TextInput value={m} onChange={(e) => setM(e.target.value)} />
          </Field>
          <Field label="b">
            <TextInput value={b} onChange={(e) => setB(e.target.value)} />
          </Field>
          <Field label="R">
            <TextInput value={R} onChange={(e) => setR(e.target.value)} />
          </Field>
        </div>
        <DirSelect dir={dir} setDir={setDir} />
        {dir === "decode" ? (
          <Field label="Word Y (hex)">
            <TextInput value={hexIn} onChange={(e) => setHexIn(e.target.value)} />
          </Field>
        ) : (
          <Field label={<T en="Value X" zh="數值 X" />}>
            <TextInput value={val} onChange={(e) => setVal(e.target.value)} />
          </Field>
        )}
        <p className="font-mono text-xs text-muted">X = (Y·10^−R − b) / m</p>
      </div>
      <div>
        {r.ok ? (
          <Results
            rows={[
              ["Word", r.value.hex],
              ["Y", r.value.y],
              ["X", fmt(r.value.value, 10)],
              ...(r.value.error !== undefined ? [[<T key="e" en="Rounding error" zh="捨入誤差" />, fmt(r.value.error, 4)] as [React.ReactNode, React.ReactNode]] : []),
            ]}
          />
        ) : (
          <ErrorText>{r.error}</ErrorText>
        )}
      </div>
    </div>
  );
}

function Pec() {
  const [bytes, setBytes] = useState("B6 21 00 02");
  const r = attempt(() => {
    const arr = pm.parseBytes(bytes);
    return { arr, crc: pm.crc8(arr) };
  });
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field
        label={<T en="Bytes (hex, include address byte with R/W bit)" zh="位元組（十六進位，需含帶 R/W 位元的位址）" />}
        hint={<T en="Example: write VOUT_COMMAND to 0x5B → B6 21 00 02" zh="範例：寫入 VOUT_COMMAND 到 0x5B → B6 21 00 02" />}
      >
        <TextInput value={bytes} onChange={(e) => setBytes(e.target.value)} />
      </Field>
      <div>
        {r.ok ? (
          <Results
            rows={[
              [<T key="n" en="Byte count" zh="位元組數" />, r.value.arr.length],
              ["PEC (CRC-8)", pm.hex(r.value.crc, 2)],
              [<T key="f" en="Full frame" zh="完整封包" />, [...r.value.arr, r.value.crc].map((b) => b.toString(16).toUpperCase().padStart(2, "0")).join(" ")],
            ]}
          />
        ) : (
          <ErrorText>{r.error}</ErrorText>
        )}
      </div>
    </div>
  );
}

export default function PmbusPage() {
  return (
    <div>
      <PageHeader
        title={<T en="PMBus data formats" zh="PMBus 資料格式" />}
        intro={<T en="Encode and decode PMBus Part II data words. Values accept SI suffixes (k, m, u…)." zh="PMBus Part II 資料字組的編碼與解碼。數值可使用 SI 字尾（k、m、u…）。" />}
      />
      <Card>
        <Tabs
          initial="l11"
          tabs={[
            { key: "l11", label: "LINEAR11" },
            { key: "l16", label: "LINEAR16 / VOUT_MODE" },
            { key: "direct", label: "DIRECT" },
            { key: "pec", label: "PEC" },
          ]}
        >
          {(k) => (k === "l11" ? <Linear11 /> : k === "l16" ? <Linear16 /> : k === "direct" ? <Direct /> : <Pec />)}
        </Tabs>
      </Card>
    </div>
  );
}
