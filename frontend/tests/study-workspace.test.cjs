// Exercise the real component handlers with mocked hooks and a delayed API.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

for (const scenario of ["study", "study-legacy", "chat"]) test(`Workspace history regression: ${scenario}`, async () => {
  const restoreLegacy = scenario !== "study";
  const chatRoute = scenario === "chat";
  const slots = [], effects = [], requests = [];
  let cursor = 0, mounted = false, rendering = false, renderDirty = false;
  let routeSubject = scenario === "chat" ? "statistics" : "mathematics";
  let routeClass = "XII";
  const slos = ["12.1.1", "12.1.2"].map(slo_code => ({
    slo_code, topic: "1", statement: `Mathematics outcome ${slo_code}`, page: null,
  }));
  const savedChats = [
    { id: "stats-chat", classLevel: "XII", subjectSlug: "statistics", title: "Statistics chat", messages: [{ id: "stats-answer", role: "assistant", content: "Saved Statistics answer" }] },
    { id: "cs-chat", classLevel: "XII", subjectSlug: "computer-science", title: "Computer Science chat", messages: [{ id: "cs-answer", role: "assistant", content: "Saved CS answer" }] },
    { id: "stats-xi", classLevel: "XI", subjectSlug: "statistics", title: "Class XI Statistics", messages: [{ id: "xi-answer", role: "assistant", content: "Class XI answer" }] },
    { id: "unknown-chat", title: "Unknown chat", messages: [] },
    { id: "study:XII:statistics", subjectSlug: "physics", title: "Conflicting subject", messages: [] },
    { id: "study:XII:mathematics:12.1.2", title: "Legacy B", messages: [{ id: "old-b", role: "assistant", content: "Legacy answer B" }] },
    { id: "study:XII:mathematics:12.1.1", title: "Legacy A", messages: [{ id: "old-a", role: "assistant", content: "Legacy answer A" }] },
    { id: "study:XI:physics:11.1.1", title: "Other subject", messages: [{ id: "other", role: "assistant", content: "Other class physics answer" }] },
  ];
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === "function" ? initial() : initial;
      return [slots[i], value => {
        const next = typeof value === "function" ? value(slots[i]) : value;
        if (rendering && !Object.is(next, slots[i])) renderDirty = true;
        slots[i] = next;
      }];
    },
    useRef(value) { return react.useState({ current: value })[0]; },
    useEffect(fn) { if (!mounted) effects.push(fn); },
  };
  const jsx = (type, props) => ({ type, props });
  function load(file, deps) {
    const module = { exports: {} };
    const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, "..", file), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    vm.runInNewContext(source, {
      module, exports: module.exports, require: name => deps[name], process,
      crypto: require("node:crypto").webcrypto,
      localStorage: { getItem: key => !restoreLegacy ? null : key === "aku-learn-chats" ? JSON.stringify(savedChats) : "study:XI:physics:11.1.1", setItem() {}, removeItem() {} },
      window: { location: { origin: "http://localhost", pathname: "/chapters" }, history: { replaceState() {} }, dispatchEvent() {} },
      PopStateEvent: class {},
      AbortController, URL, URLSearchParams, console,
      fetch: async (url, options) => {
        if (String(url).includes("/chapters")) return { ok: true, json: async () => ({ chapters: [{ chapter: 1, title: "Mathematics", slos }] }) };
        if (String(url).includes("/quiz")) return { ok: true, json: async () => ({ questions: [] }) };
        return new Promise(resolve => requests.push({ body: JSON.parse(options.body), resolve }));
      },
    });
    return module.exports;
  }
  const Workspace = load("components/study-workspace.tsx", {
    react, "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "next/image": { default: "image" }, "next/link": { default: "link" },
    "react-markdown": { default: "markdown" },
    "lucide-react": new Proxy({}, { get: (_, key) => String(key) }),
    "../lib/curriculum": load("lib/curriculum.ts", {}),
    "../lib/selection-context": { useSelection: () => ({ setSelection() {} }) },
  }).default;
  const render = () => {
    let tree, attempts = 0;
    do {
      assert.ok(attempts++ < 5, "Render synchronization must settle");
      cursor = 0; renderDirty = false; rendering = true;
      tree = Workspace({ initialView: chatRoute ? "chat" : "study", initialClassLevel: routeClass, initialSubjectSlug: routeSubject });
      rendering = false;
    } while (renderDirty);
    return tree;
  };
  function nodes(tree) {
    if (!tree || typeof tree !== "object") return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    return [tree, ...nodes(tree.props?.children)];
  }
  const find = (tree, predicate) => { const node = nodes(tree).find(predicate); assert.ok(node, "Expected element"); return node; };
  const tick = () => new Promise(resolve => setImmediate(resolve));
  const text = tree => JSON.stringify(tree);
  const select = code => find(render(), n => n.type === "button" && n.props["aria-pressed"] !== undefined && text(n.props.children).includes(code)).props.onClick();
  function send(value) {
    find(render(), n => n.type === "textarea").props.onChange({ target: { value }, currentTarget: { style: {}, scrollHeight: 20 } });
    find(render(), n => n.type === "button" && n.props.className === "babul-send").props.onClick();
  }
  async function answer(index, content) {
    requests[index].resolve({ ok: true, json: async () => ({ answer: content }) });
    await tick();
  }
  render(); mounted = true;
  effects.forEach(fn => fn());
  await tick();
  const displayed = () => nodes(render()).filter(n => n.props?.className === "babul-message-content").map(text).join("\n");
  const recentSubject = title => text(find(render(), n => n.type === "button" && n.props.title === title));
  if (chatRoute) {
    assert.ok(displayed().includes("Saved Statistics answer"));
    assert.ok(!displayed().includes("Class XI answer"));
    assert.ok(!displayed().includes("Other class physics answer"));
    const countChats = () => slots.find(value => Array.isArray(value) && value.some(chat => chat?.id === "stats-chat")).length;
    const before = countChats();
    send("Explain again");
    assert.equal(countChats(), before, "Restored chat is reused rather than creating another");
    assert.equal(requests[0].body.subject, "statistics");
    assert.ok(requests[0].body.history.some(message => message.content === "Saved Statistics answer"));
    await answer(0, "Statistics follow-up");
    let currentSearch = "class=XII&subject=statistics";
    const featureModule = load("components/feature-page.tsx", {
      react, "react/jsx-runtime": { jsx, jsxs: jsx }, "next/link": { default: "link" },
      "next/navigation": {
        useRouter: () => ({ replace() {} }),
        useSearchParams: () => new URLSearchParams(currentSearch),
      },
      "./study-workspace": { default: Workspace },
      "../lib/curriculum": load("lib/curriculum.ts", {}),
      "../lib/selection-context": { useSelection: () => ({ selection: null, hydrated: true, setSelection() {} }) },
      // Keep the old popstate snapshot stale to verify that Next's query wins.
      "../lib/use-location-search": { useLocationSearch: () => "?class=XII&subject=statistics" },
    });
    function navigate(subject, schoolClass = "XII") {
      currentSearch = `class=${schoolClass}&subject=${subject}`;
      const subscribed = featureModule.ChatFeaturePage();
      const route = featureModule.default(subscribed.props);
      assert.equal(route.type, Workspace);
      routeSubject = route.props.initialSubjectSlug;
      routeClass = route.props.initialClassLevel;
      assert.equal(routeSubject, subject);
      assert.equal(routeClass, schoolClass);
      // Re-render the SAME workspace hook state, with no reload or remount.
      const tree = render();
      assert.equal(find(tree, n => n.props?.id === "sidebar-subject").props.value, subject);
      const heading = find(tree, n => n.props?.className === "babul-status");
      assert.ok(text(heading).includes(load("lib/curriculum.ts", {}).subjectLabel(subject)));
    }
    navigate("mathematics");
    assert.ok(displayed().includes("Legacy answer A"));
    assert.ok(!displayed().includes("Saved Statistics answer"));
    send("Mathematics pending question");
    assert.equal(requests[1].body.subject, "mathematics");
    navigate("statistics");
    assert.ok(displayed().includes("Statistics follow-up"));
    assert.ok(!displayed().includes("Mathematics pending question"));
    await answer(1, "Delayed Mathematics answer");
    assert.ok(!displayed().includes("Delayed Mathematics answer"));
    navigate("computer-science");
    assert.ok(displayed().includes("Saved CS answer"));
    assert.ok(!displayed().includes("Statistics follow-up"));
    send("Computer science question");
    assert.equal(requests[2].body.subject, "computer-science");
    assert.ok(!requests[2].body.history.some(m => m.content === "Statistics follow-up"));
    await answer(2, "CS follow-up");
    navigate("mathematics");
    assert.ok(displayed().includes("Delayed Mathematics answer"));
    assert.ok(!displayed().includes("CS follow-up"));
    navigate("physics");
    assert.equal(displayed(), "", "No saved history shows the selected empty chat");
    navigate("statistics", "XI");
    assert.ok(displayed().includes("Class XI answer"));
    assert.ok(!displayed().includes("Statistics follow-up"));
    navigate("statistics");
    assert.ok(displayed().includes("Statistics follow-up"));
    return;
  }
  if (restoreLegacy) {
    assert.ok(recentSubject("Statistics chat").includes("Statistics"));
    assert.ok(recentSubject("Unknown chat").includes("Subject unavailable"));
    assert.ok(recentSubject("Conflicting subject").includes("Subject unavailable"));
    assert.ok(recentSubject("Legacy A").includes("Mathematics"));
    assert.ok(recentSubject("Legacy A").includes("AKU-EB Curriculum"));
    assert.ok(displayed().includes("Legacy answer A"));
    assert.ok(displayed().includes("Legacy answer B"));
    assert.ok(!displayed().includes("Other class physics answer"));
    // Migration preserves the source chats rather than deleting them.
    assert.ok(slots.some(value => Array.isArray(value) && savedChats.every(saved => value.some(chat => chat.id === saved.id))));
  }
  select("12.1.1");
  assert.equal(requests.length, 1, "SLO selection auto-sends");
  const newChat = slots.flatMap(value => Array.isArray(value) ? value : []).find(chat => chat?.id === "study:XII:mathematics");
  assert.equal(newChat.subjectSlug, "mathematics");
  assert.match(requests[0].body.question, /Explain this Mathematics learning outcome.*SLO 12\.1\.1/);
  assert.equal(requests[0].body.marks, "2");
  assert.equal(requests[0].body.subject, "mathematics");
  assert.equal(requests[0].body.grade, 12);
  select("12.1.1");
  assert.equal(requests.length, 1, "Duplicate pending click is ignored");
  select("12.1.2");
  select("12.1.2");
  assert.equal(requests.length, 1, "New SLO waits for the previous answer");
  await answer(0, "Answer A");
  assert.equal(requests.length, 2, "Queued SLO auto-sends once");
  assert.match(requests[1].body.question, /SLO 12\.1\.2/);
  assert.ok(requests[1].body.history.some(m => m.content === "Answer A"));
  await answer(1, "Answer B");
  const conversation = displayed();
  assert.ok(conversation.includes("Answer A"));
  assert.ok(conversation.includes("Answer B"));
  assert.ok(conversation.indexOf("12.1.1") < conversation.indexOf("Answer A"));
  assert.ok(conversation.indexOf("Answer A") < conversation.indexOf("12.1.2"));
  assert.ok(conversation.indexOf("12.1.2") < conversation.indexOf("Answer B"));
  send("samj nahi aya (2 marks)");
  assert.equal(requests[2].body.question, "samj nahi aya (2 marks)");
  assert.match(requests[2].body.history.at(-1).content, /SLO 12\.1\.2/);
  assert.ok(requests[2].body.history.some(m => m.content === "Answer A"));
  assert.ok(requests[2].body.history.some(m => m.content === "Answer B"));
  await answer(2, "Follow-up B");
  send("example do (2 marks)");
  assert.match(requests[3].body.history.at(-1).content, /SLO 12\.1\.2/);
  await answer(3, "Example B");
  assert.ok(displayed().includes("Follow-up B"));
  assert.ok(displayed().includes("Example B"));
  find(render(), n => n.props?.className?.includes("babul-nav-item") && text(n).includes("Study by chapter")).props.onClick();
  assert.equal(find(render(), n => n.props?.id === "study-chapter-list").props.className.startsWith("flex"), true);
  assert.ok(displayed().includes("Answer A"));
  find(render(), n => n.props?.id === "sidebar-subject").props.onChange({ target: { value: "physics" } });
  assert.ok(!displayed().includes("Answer A"));
  find(render(), n => n.props?.["aria-controls"] === "study-chapter-1").props.onClick();
  select("12.1.1");
  assert.equal(requests[4].body.subject, "physics");
  assert.ok(!requests[4].body.history.some(m => m.content === "Answer A"));
  await answer(4, "Physics answer");
  find(render(), n => n.props?.id === "sidebar-class").props.onChange({ target: { value: "XI" } });
  assert.ok(!displayed().includes("Physics answer"));
  find(render(), n => n.props?.id === "sidebar-class").props.onChange({ target: { value: "XII" } });
  find(render(), n => n.props?.id === "sidebar-subject").props.onChange({ target: { value: "mathematics" } });
  assert.ok(displayed().includes("Answer A"));
  assert.ok(displayed().includes("Answer B"));
});
