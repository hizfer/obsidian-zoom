function isHeader(line) {
  return line.startsWith("# ");
}

function isAction(line) {
  return line.startsWith("- ");
}

function isCodeBlock(line) {
  return line.startsWith("```");
}

function parseState(l) {
  if (!isCodeBlock(l.line)) {
    throw new Error(
      `parseState: Unexpected line "${l.line}", expected "\`\`\`"`
    );
  }

  const lines = [];

  while (true) {
    l.next();

    if (l.isEnded()) {
      throw new Error(`parseState: Unexpected EOF, expected "\`\`\`"`);
    } else if (isCodeBlock(l.line)) {
      l.nextNotEmpty();
      return {
        lines,
      };
    } else {
      lines.push(l.line);
    }
  }
}

function parseApplyState(l) {
  l.nextNotEmpty();

  return {
    type: "applyState",
    state: parseState(l),
  };
}

function parseAssertState(l) {
  l.nextNotEmpty();

  return {
    type: "assertState",
    state: parseState(l),
  };
}

function parseSimulateKeydown(l) {
  const key = l.line.replace(/- keydown: `([^`]+)`/, "$1");

  l.nextNotEmpty();

  return {
    type: "simulateKeydown",
    key,
  };
}

function parsePlatform(l) {
  const platform = l.line.replace(/- platform: `([^`]+)`/, "$1");

  l.nextNotEmpty();

  return {
    type: "platform",
    platform,
  };
}

function parseExecuteCommandById(l) {
  const command = l.line.replace(/- execute: `([^`]+)`/, "$1");

  l.nextNotEmpty();

  return {
    type: "executeCommandById",
    command,
  };
}

function parseReplaceSelection(l) {
  const char = l.line.replace(/- replaceSelection: `([^`]+)`/, "$1");

  l.nextNotEmpty();

  return {
    type: "replaceSelection",
    char,
  };
}

function parseAction(l) {
  if (!isAction(l.line)) {
    throw new Error(
      `parseAction: Unexpected line "${l.line}", expected ACTION`
    );
  }

  if (l.line.startsWith("- applyState:")) {
    return parseApplyState(l);
  } else if (l.line.startsWith("- keydown:")) {
    return parseSimulateKeydown(l);
  } else if (l.line.startsWith("- execute:")) {
    return parseExecuteCommandById(l);
  } else if (l.line.startsWith("- replaceSelection:")) {
    return parseReplaceSelection(l);
  } else if (l.line.startsWith("- assertState:")) {
    return parseAssertState(l);
  } else if (l.line.startsWith("- platform:")) {
    return parsePlatform(l);
  }

  throw new Error(`parseAction: Unknown action "${l.line}"`);
}

function parseTest(l) {
  if (!isHeader(l.line)) {
    throw new Error(`parseTest: Unexpected line "${l.line}", expected HEADER`);
  }

  const title = l.line.replace(/^# /, "").trim();
  const actions = [];

  l.nextNotEmpty();

  while (!l.isEnded() && !isHeader(l.line)) {
    actions.push(parseAction(l));
  }

  return {
    title,
    actions,
  };
}

function parseTests(l) {
  l.nextNotEmpty();

  const tests = [];

  while (!l.isEnded()) {
    tests.push(parseTest(l));
  }

  return tests;
}

class LinesIterator {
  constructor(lines) {
    this.i = -1;
    this.lines = lines;
    this.len = this.lines.length;
  }

  get line() {
    return this.lines[this.i];
  }

  isEnded() {
    return this.i >= this.len;
  }

  nextNotEmpty() {
    do {
      this.i++;
    } while (!this.isEnded() && this.line.trim() === "");
  }

  next() {
    this.i++;
  }
}

module.exports.process = function process(sourceText, sourcePath, options) {
  const l = new LinesIterator(sourceText.split("\n"));
  const s = (v) => JSON.stringify(v);

  const name = sourcePath.replace(options.config.cwd + "/", "");

  let code = "";
  code += `describe(${s(name)}, () => {\n`;

  for (const test of parseTests(l)) {
    const platform = test.actions.find((a) => a.type === "platform");
    const testFn =
      platform && process.platform !== platform.platform ? "test.skip" : "test";

    code += `  ${testFn}(${s(test.title)}, async () => {\n`;

    for (const action of test.actions) {
      switch (action.type) {
        case "applyState":
          code += `    await applyState(${s(action.state.lines)});\n`;
          break;
        case "simulateKeydown":
          code += `    await simulateKeydown(${s(action.key)});\n`;
          break;
        case "executeCommandById":
          code += `    await executeCommandById(${s(action.command)});\n`;
          break;
        case "replaceSelection":
          code += `    await replaceSelection(${s(action.char)});\n`;
          break;
        case "assertState":
          code += `    // Waiting for all operations to be applied\n`;
          code += `    await new Promise((resolve) => setTimeout(resolve, 10));\n`;
          code += `    await expect(await getCurrentState()).toEqualEditorState(${s(
            action.state.lines
          )});\n`;
          break;
      }
    }

    code += `  });\n`;
  }

  code += `});\n`;

  return {
    code,
  };
};
