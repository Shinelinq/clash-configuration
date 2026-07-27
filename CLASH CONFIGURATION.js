// ⚠️ 本脚本仅适用于 Clash Meta (mihomo) 内核
// =============================================================================
// 0) 全局常量区：统一的“配置常量 + 策略字典”
// -----------------------------------------------------------------------------
// 目标：
// 1) 把所有可调参数集中在顶部，避免在逻辑中散落硬编码。
// 2) 让脚本更可读：看到常量就能知道“这份配置在做什么”。
// 3) 同一份脚本用于 PC / 手机端时，尽量保证行为一致。
// =============================================================================

// ----------------------------- 总出口策略组名 -----------------------------
// - 规则未命中时（MATCH）会走这里
// - 规则组选择 PROXY 时也会最终指向这里
// - 你在客户端 UI 中最终主要操作的“总开关”
const PROXY_NAME = "Proxy";

// ----------------------------- 节点测速参数 -----------------------------
// 用于 url-test / Auto 组的健康检查：
// - TEST_URL：轻量 204 返回，适合做连通性与延迟探测
// - TEST_INTERVAL：测速周期（秒）
// - TEST_TOLERANCE：延迟容差（ms），减少抖动导致的频繁切换
const TEST_URL = "https://cp.cloudflare.com/generate_204";
const TEST_INTERVAL = 600;
const TEST_TOLERANCE = 50;

// 国内 DNS：用于处理国内域名解析，避免绕路/解析慢
const cnDnsList = [
  "223.5.5.5", "223.6.6.6",
  "119.29.29.29", "119.28.28.28",
];

// 可信 DoH：用于国际域名解析，降低污染概率
const trustDnsList = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/dns-query",
  "https://1.1.1.1/dns-query",
  "https://8.8.4.4/dns-query",
];

// ===================== 手动节点（链式代理出口） =====================
// 说明：
// - MANUAL_PROXIES 用于维护你“手动添加”的节点（会被注入到 config.proxies）。
// - 本脚本的链式代理设计：
//   * 机场/订阅节点作为“入口（Entry）”或普通出口（normalProxies）
//   * 手动节点作为“出口（Exit）”
// - 注意：新版 mihomo / Clash Party 已移除 relay，链式代理改用 dialer-proxy：
//   手动节点会被自动写入 dialer-proxy: CHAIN_ENTRY_GROUP_NAME。
// - 链式体系启用条件（硬规则）：
//   “最终成功注入的手动节点数量 > 0” 时才生成链式相关策略组，避免空组污染界面。
const MANUAL_RENAME_SUFFIX = " (Manual)";

// 你的手动节点列表：为空则完全不启用链式代理体系（入口/出口/链式代理组都不生成）
// 示例（请自行填写 server/port/账号等）：
// const MANUAL_PROXIES = [
  // ---- 模板：trojan ----
  // {
  //   name: "名字",
  //   type: "trojan",
  //   server: "域名或IP",
  //   port: 443,
  //   password: "密码",
  //   sni: "域名",
  //   udp: true,
  // },
  
  // ---- 模板：socks5 ----
  // {
  //   name: "名字",
  //   type: "socks5",
  //   server: "IP",
  //   port: 1080,
  //   username: "用户名",
  //   password: "密码",
  //   udp: true,
  // },
  // ---- 模板：ss ----
  // {
  //   name: "名字",
  //   type: "ss",
  //   server: "IP",
  //   port: 8388,
  //   cipher: "aes-256-gcm",
  //   password: "密码",
  //   udp: true,
  // },
// ];
const MANUAL_PROXIES = [];

// ===================== 链式代理（dialer-proxy）分组命名 =====================
// - CHAIN_ENTRY_GROUP_NAME：链路入口（中转节点）：Auto + 普通节点 + DIRECT
// - CHAIN_EXIT_GROUP_NAME：链路出口（手动添加）：仅手动节点（不含 DIRECT，语义更纯）
// - CHAIN_RELAY_GROUP_NAME：链式代理总开关（select）：指向出口组；出口节点通过 dialer-proxy 使用入口组拨号
const CHAIN_ENTRY_GROUP_NAME = "链路入口（中转节点）";
const CHAIN_EXIT_GROUP_NAME = "链路出口（手动添加）";
const CHAIN_RELAY_GROUP_NAME = "📡 链式代理";

// ===================== 规则职责分层总览（维护必读） =====================
// 说明：
// - REMOTE_RULESETS：标准远程规则组元数据；这里的数组顺序会进入真实 rules，属于“行为层顺序”。
// - RULES_SKELETON：规则骨架 / 系统兜底 / 安全保护；这里定义 LAN 本地保护、国内兜底、MATCH。
// - CUSTOM_RULE_GROUPS：本地自定义规则；由 addCustomRules() 插入到第一条远程 RULE-SET 之前。
// - 最终匹配骨架固定为：
//   LAN 本地硬编码保护 -> 本地自定义规则 -> 远程规则集 -> 国内兜底 -> MATCH
// - 维护提示：不要把 proxy-groups 的显示顺序误认为 rules 的实际执行顺序。

// ===================== 标准远程规则组（统一数据源） =====================
// 说明：
// - 这里统一维护“标准远程 rule-provider / RULE-SET / 同名 proxy-group”的唯一数据源。
// - name 必须同时作为：
//   * rule-provider 名
//   * RULE-SET 名
//   * proxy-group 名
// - policy 只描述该分组在 UI 中的默认倾向：
//   DIRECT / PROXY / REJECT
// - 维护提示：这里的数组顺序会影响远程 RULE-SET 的生成顺序，也会影响真实规则匹配优先级。
// - 不要把这里理解成单纯展示顺序；修改这里属于“行为层修改”，不是 UI 调整。
// - UI 中远程规则组的显示顺序由 REMOTE_RULESET_DISPLAY_ORDER 单独控制，两者不要混用。
// - 本次采用“当前实际分流优先级”顺序，确保真实分流行为与当前脚本保持一致。
// - 可选扩展字段（全部可省略）：
//   * behavior / format / interval / path / noResolve
//   * 未填写时，会自动回退到当前脚本的默认行为
// - 新增一个标准远程规则组时，主要入口先改这里。
// - 若还希望它在 UI 中出现或按指定位置显示，再同步检查 REMOTE_RULESET_DISPLAY_ORDER。
const REMOTE_RULESETS = [
  {
    name: "LAN",
    policy: "DIRECT",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Lan/Lan_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/WiFi.png",
  },
  {
    name: "广告拦截",
    policy: "REJECT",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/AdvertisingLite/AdvertisingLite_Classical_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Reject.png",
  },
  {
    name: "OpenAI",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/OpenAI/OpenAI_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ChatGPT.png",
  },
  {
    name: "Gemini",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Gemini/Gemini_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/AI.png",
  },
  {
    name: "Grok",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/Accademia/Additional_Rule_For_Clash@main/Grok/Grok_No_Resolve.yaml",
    icon: "https://x.ai/favicon.ico",
  },
  {
    name: "Claude",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Claude/Claude_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@latest/light/claude-color.png",
  },
  {
    name: "GitHub",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/GitHub/GitHub_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/GitHub.png",
  },
  {
    name: "Google",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Google/Google_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Google.png",
  },
  {
    name: "PayPal",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/PayPal/PayPal_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/PayPal.png",
  },
  {
    name: "SteamCN",
    policy: "DIRECT",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/SteamCN/SteamCN_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Steam.png",
  },
  {
    name: "Steam",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/Steam/Steam_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Steam.png",
  },
  {
    name: "全球媒体",
    policy: "PROXY",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/GlobalMedia/GlobalMedia_Classical_No_Resolve.yaml",
    // Qure Color 里没有 GlobalMedia.png，因此“全球媒体”使用 ForeignMedia 图标
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/ForeignMedia.png",
  },
  {
    name: "国内网站",
    policy: "DIRECT",
    url: "https://cdn.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/ChinaMax/ChinaMax_Classical_No_IPv6_No_Resolve.yaml",
    icon: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/China.png",
  },
];

// ===================== 远程规则本地锁定名单 =====================
// 说明：
// - 这里只写 REMOTE_RULESETS 中的规则库名称；被列入后将优先读取本地缓存文件。
// - 仅对 REMOTE_RULESETS 中实际存在的名称生效；不存在的名称会自动忽略。
// - 本地文件路径仍然复用 provider 默认 path 逻辑，不额外新增自定义路径入口。
// 用法：
// - 把规则库 name 写进这里，就会停止远程更新，改读本地已缓存文件。
// - name 必须和 REMOTE_RULESETS 里的 name 完全一致；写错会被自动忽略。
// - 不用写路径，脚本会继续用原来的 ./ruleset/${name}.yaml。
// - 加入前请先让规则库成功更新过一次；脚本不会帮你翻冰箱确认有没有存货。
// - 想更新已锁定规则库：先从名单移除，更新完成后再加回来。
//
// 示例：const LOCAL_RULESET_LOCK_NAMES = ["OpenAI", "Grok"];
const LOCAL_RULESET_LOCK_NAMES = [];
const LOCAL_RULESET_LOCK_NAME_SET = new Set(
  LOCAL_RULESET_LOCK_NAMES.filter((name) =>
    REMOTE_RULESETS.some((item) => item.name === name)
  )
);

// ===================== 远程规则组显示顺序（仅影响 UI） =====================
// 说明：
// - 这里只控制 proxy-groups 中“标准远程规则组”的显示顺序，属于“显示层调整”。
// - 不影响 rule-provider 生成顺序，不影响远程 RULE-SET 的实际匹配顺序。
// - 修改这里不会改变分流逻辑；不要把 proxy-groups 的显示顺序误认为 rules 的执行顺序。
// - 新增远程规则组时，如果希望它在 UI 中出现，也要同步补这里。
// - 若写入了 REMOTE_RULESETS 中不存在的名称，会在生成时自动忽略。
const REMOTE_RULESET_DISPLAY_ORDER = [
  "LAN",
  "国内网站",
  "全球媒体",
  "OpenAI",
  "Gemini",
  "Grok",
  "Claude",
  "Google",
  "GitHub",
  "SteamCN",
  "Steam",
  "PayPal",
  "广告拦截",
];

// ===================== 规则骨架（系统级行为层，独立于远程规则组） =====================
// 说明：
// - 这里保留“规则骨架”，不并入 REMOTE_RULESETS，也不是普通规则组配置。
// - 原因：这些规则属于系统兜底 / 安全保护，不是远程 rule-provider 元数据。
// - 这里定义的是整个分流体系的骨架，而不是某个单独规则组的显示信息。
// - 改动这里往往属于系统级行为调整，应谨慎。
// - 以后若要调整 LAN 本地保护、国内兜底、MATCH，请只改这里。
const RULES_SKELETON = {
  // 本地 LAN 硬兜底：即使远程规则集失效，也保证内网/本机资源永远直连
  localProtection: [
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,127.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,169.254.0.0/16,DIRECT,no-resolve",
    "DOMAIN-SUFFIX,local,DIRECT",
    "DOMAIN-SUFFIX,lan,DIRECT",
  ],

  // 国内两层兜底：把漏网但实际属于国内的流量导入「国内网站」UI
  domesticFallback: [
    "GEOSITE,cn,国内网站",
    "GEOIP,CN,国内网站,no-resolve",
  ],

  // 最终兜底：所有未命中流量走总出口
  finalFallback: [
    "MATCH," + PROXY_NAME,
  ],
};

// ===================== 分组图标映射（纯 UI，不影响逻辑） =====================
// - 仅注入 icon 字段，不改变组的 proxies/type/顺序等逻辑
// - key 必须与 proxy-group 的 name 完全一致，否则匹配不到
const GROUP_ICONS = {
  // 总出口与自动测速组
  "Proxy": "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Proxy.png",
  "🌏 Auto": "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Auto.png",

  // 链式代理相关
  [CHAIN_ENTRY_GROUP_NAME]: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Rocket.png",
  [CHAIN_EXIT_GROUP_NAME]: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Server.png",
  [CHAIN_RELAY_GROUP_NAME]: "https://cdn.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Loop.png",

  // 地区测速组（必须与 regionProxyGroups 的 name 完全一致）
  "🇭🇰 Hong Kong": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Hong_Kong.png",
  "🇸🇬 Singapore": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Singapore.png",
  "🇯🇵 Japan": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/Japan.png",
  "🇺🇸 United States": "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/United_States.png",
};

// 远程规则组图标映射：统一从 REMOTE_RULESETS 派生，避免 UI 信息多处维护
const REMOTE_RULESET_ICONS = Object.fromEntries(
  REMOTE_RULESETS
    .filter(item => item.icon !== undefined)
    .map(item => [item.name, item.icon])
);

// ===================== 本地自定义规则组（本地特权层） =====================
// 说明：
// - 这里维护的是“本地自定义规则 + 对应策略组元数据”，用于放你自己想优先命中的站点或域名。
// - 它不是 REMOTE_RULESETS：不会参与 rule-provider 生成，也不是标准远程规则集元数据。
// - 它也不是 RULES_SKELETON：不负责 LAN 本地保护、国内兜底、MATCH 这类系统骨架。
// - 实际规则会由 addCustomRules() 插入到第一条远程 RULE-SET 之前，
//   所以优先级高于所有远程规则集，但仍低于 RULES_SKELETON.localProtection。
// - 维护提示：这里只定义“本地自定义规则层”的内容，不要和远程规则层、骨架层混在一起改。
const CUSTOM_RULE_GROUPS = {
  "linux.do": {
    policy: "PROXY",
    icon: "https://linux.do/uploads/default/original/3X/9/d/9dd49731091ce8656e94433a26a3ef36062b3994.png",
    rules: [
      "DOMAIN-SUFFIX,linux.do"
    ]
  },

  // =============================
  // 示例：未来新增自定义规则组
  //
  // 只需要在此处添加：
  //
  // "example.com": {
  //   policy: "DIRECT",
  //   icon: "图标URL",
  //   rules: [
  //     "DOMAIN-SUFFIX,example.com",
  //     "DOMAIN,sub.example.com"
  //   ]
  // }
  //
  // 不需要修改任何函数逻辑
  // =============================
};

// 地区匹配正则（支持中文/英文/旗帜/常见缩写/数字后缀）
const regionFilterRegexs = [
  {
    name: "🇭🇰 Hong Kong",
    regex: /香港|Hong[\s\-_]*Kong|🇭🇰|(?<![a-zA-Z])HKG(?![a-zA-Z])|(?<![a-zA-Z])HK\d*(?![a-zA-Z])/i,
  },
  {
    name: "🇸🇬 Singapore",
    regex: /新加坡|狮城|Singapore|🇸🇬|(?<![a-zA-Z])SIN(?![a-zA-Z])|(?<![a-zA-Z])SGP(?![a-zA-Z])|(?<![a-zA-Z])SG\d*(?![a-zA-Z])/i,
  },
  {
    name: "🇯🇵 Japan",
    regex: /日本|东京|大阪|Japan|Tokyo|Osaka|🇯🇵|(?<![a-zA-Z])JPN(?![a-zA-Z])|(?<![a-zA-Z])NRT(?![a-zA-Z])|(?<![a-zA-Z])KIX(?![a-zA-Z])|(?<![a-zA-Z])JP\d*(?![a-zA-Z])/i,
  },
  {
    name: "🇺🇸 United States",
    regex: /美国|洛杉矶|硅谷|西雅图|圣何塞|达拉斯|凤凰城|United[\s\-_]*States|America|🇺🇸|(?<![a-zA-Z])USA(?![a-zA-Z])|(?<![a-zA-Z])LAX(?![a-zA-Z])|(?<![a-zA-Z])SJC(?![a-zA-Z])|(?<![a-zA-Z])SEA(?![a-zA-Z])|(?<![a-zA-Z])DFW(?![a-zA-Z])|(?<![a-zA-Z])US\d*(?![a-zA-Z])/i,
  },
];

// =============================================================================
// 1) 主流程：入口与“代理名收集”
// -----------------------------------------------------------------------------
// 这里统一收集代理名称，供：分组生成、测速、地区筛选使用。
// 从 config.proxies 收集所有节点名称，供分组生成、测速、地区筛选使用。
// Clash Verge / Party 等客户端会在脚本执行前将订阅节点解析到 config.proxies。
// 同时遍历 proxy-providers 以备兼容，但主流客户端中 provider 节点在脚本执行阶段尚未加载，该遍历通常不会收集到节点。
// =============================================================================
function getAllProxyNames(config){
  // 订阅解析后节点通常在 config.proxies 中
  const names = [];

  // proxies 字段：订阅解析后节点通常在这里
  if (Array.isArray(config.proxies) && config.proxies.length) {
    names.push(...config.proxies.map(p => p && p.name).filter(Boolean));
  }

  // 遍历 proxy-providers 以备兼容；主流客户端中 provider 节点
  // 在脚本执行阶段尚未加载到此字段，通常不会命中
  const providers = config["proxy-providers"] || {};
  for (const key of Object.keys(providers)) {
    const p = providers[key];
    if (Array.isArray(p.proxies)) {
      names.push(...p.proxies.map(x => x && x.name).filter(Boolean));
    }
  }

  // 去重后返回
  return [...new Set(names)];
}

// =============================================================================
// 手动节点最小格式校验
// -----------------------------------------------------------------------------
// 目的：避免“写了 MANUAL_PROXIES 但全部无效”，导致链式出口组空。
// 这里只做最关键字段的存在性校验，不做过度校验（避免误伤不同协议字段差异）。
// =============================================================================
function isValidManualProxy(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (!raw.name) return false;
  if (!raw.type) return false;
  if (!raw.server) return false;
  if (raw.port === undefined || raw.port === null || raw.port === "") return false;
  return true;
}

// =============================================================================
// 主入口：把“客户端加载到的 config”加工成你想要的最终配置
// -----------------------------------------------------------------------------
// 说明：
// - overwriteRules() 负责生成真实 rules / rule-providers，是实际匹配顺序的核心来源之一。
// - overwriteProxyGroups() 负责生成 UI 中的策略组与候选项，不决定真实 rules 的执行顺序。
// - 调用顺序不要误解为最终匹配顺序：
//   addCustomRules() 虽然最后调用，但它会把本地自定义规则插到第一条远程 RULE-SET 之前。
// - 因此最终匹配骨架仍然是：
//   LAN 本地硬编码保护 -> 本地自定义规则 -> 远程规则集 -> 国内兜底 -> MATCH
// =============================================================================
function main(config) {
  // 基本校验：防止 config 为 null/undefined
  if (!config || typeof config !== "object") return config || {};
  // 备份原始配置：出错时返回干净备份，而不是被改了一半的 config
  let backup;
  try {
    backup = JSON.parse(JSON.stringify(config));
  } catch (_) {
    backup = config; // 极端情况：备份失败就用原引用，比崩掉强
  }

  try {
    // ---------- (A) 手动节点注入（链式出口节点来源） ----------
    // 确保 proxies 是数组（某些订阅格式可能缺失此字段）
    if (!Array.isArray(config.proxies)) config.proxies = [];

    // 记录最终注入成功的手动节点名（用于后续分层：manual vs normal）
    const manualNames = [];

    // 注入手动节点：处理撞名 + 强制写入 dialer-proxy + 最小校验
    if (Array.isArray(MANUAL_PROXIES) && MANUAL_PROXIES.length > 0) {
      const existingNames = new Set(getAllProxyNames(config));

      for (const raw of MANUAL_PROXIES) {
        if (!isValidManualProxy(raw)) continue;

        // 复制一份，避免外部常量被意外改动
        const p = { ...raw };

        // 撞名消解：仅对手动节点生效、一次性稳定改名
        let finalName = String(p.name);
        if (existingNames.has(finalName)) {
          let i = 1;
          let candidate = `${finalName}${MANUAL_RENAME_SUFFIX}`;
          while (existingNames.has(candidate)) {
            i += 1;
            candidate = `${finalName}${MANUAL_RENAME_SUFFIX}-${i}`;
          }
          finalName = candidate;
          p.name = finalName;
        }

        // 新版 mihomo 已移除 relay。链式出口节点通过 dialer-proxy 指向入口组，
        // 入口组仍由 UI 选择：Auto / 普通节点 / DIRECT。
        p["dialer-proxy"] = CHAIN_ENTRY_GROUP_NAME;

        existingNames.add(finalName);
        manualNames.push(finalName);
        config.proxies.push(p);
      }
    }

    // 将“手动节点名列表”挂到 config 上，供后续流程使用（分层/排除/链式生成）
    config._manualProxyNames = manualNames;

    // ---------- (B) 收集所有节点名 ----------
    const allProxies = getAllProxyNames(config);

    // 如果没有拿到任何节点名称，说明当前配置未展开/无节点，直接原样返回
    if (!allProxies.length) return config;

    // 将“全部代理名”挂到 config 上，供后续函数统一使用
    config._allProxyNames = allProxies;

    // ---------- (C) 流水线加工 ----------
    overwriteRules(config);        // 生成 rule-providers + rules
    overwriteProxyGroups(config);  // 生成 proxy-groups（UI 层：地区测速组、规则组、链式代理组）
    overwriteDns(config);          // 覆写 DNS 与相关高级选项
    overwriteMiscOptions(config);
    addCustomRules(config);        // 虽然这里最后执行，但会把本地自定义规则插到第一条远程 RULE-SET 之前；不要误解为“后调用 = 后匹配”

    // 清理内部临时字段，避免污染传给内核的 config
    delete config._allProxyNames;
    delete config._manualProxyNames;

    return config;

  } catch (e) {
    console.log("脚本执行出错，回退到原始配置：" + (e.message || e));
    try {
      delete backup._allProxyNames;
      delete backup._manualProxyNames;
    } catch (_) {}
    return backup;
  }
}


// =============================================================================
// 2) 自定义规则：本地特权通道（高优先级，仅次于 LAN 保护）
// -----------------------------------------------------------------------------
// 这里放你“最想优先命中”的本地规则（例如自己的常用站点）。
// 这些规则会插到第一条远程 RULE-SET 之前，因此优先于所有远程规则集。
// 但它们仍然位于 RULES_SKELETON.localProtection 之后，不会覆盖 LAN 本地硬编码保护。
// 维护提示：这里处理的是“本地自定义规则的实际插入位置”，不是 UI 显示顺序。
// =============================================================================
function addCustomRules(config) {
  const customRules = [];
  Object.keys(CUSTOM_RULE_GROUPS).forEach((key) => {
    const rules = CUSTOM_RULE_GROUPS[key] && CUSTOM_RULE_GROUPS[key].rules;
    if (Array.isArray(rules)) {
      rules.forEach((r) => {
        customRules.push(r + "," + key);
      });
    }
  });

  let rules = config["rules"];
  if (!Array.isArray(rules)) rules = [];
  // 维护提示：这里按“第一条 RULE-SET 的位置”回插。
  // 所以即使 addCustomRules() 在 main() 里最后调用，最终顺序仍然是：
  // LAN 本地硬编码保护 -> 本地自定义规则 -> 远程规则集 -> ...
  const insertIndex = rules.findIndex(r => typeof r === "string" && r.startsWith("RULE-SET,"));
  if (insertIndex >= 0) {
    rules.splice(insertIndex, 0, ...customRules);
    config["rules"] = rules;
  } else {
    config["rules"] = [...customRules, ...rules];
  }
}


// =============================================================================
// 辅助函数：生成远程规则组的 provider 配置（支持向后兼容扩展字段）
// -----------------------------------------------------------------------------
// - 仅负责把 REMOTE_RULESETS 某一项转换成 rule-provider 配置
// - 如果未来某个远程规则组需要单独指定 behavior / format / interval / path，
//   只需要在对应项上填写；未填写时保持当前默认值不变
// =============================================================================
function isLocalRulesetLocked(item) {
  return !!(item && LOCAL_RULESET_LOCK_NAME_SET.has(item.name));
}

function getRemoteRulesetProviderConfig(item) {
  const behavior = item.behavior !== undefined ? item.behavior : "classical";
  const path = item.path !== undefined ? item.path : `./ruleset/${item.name}.yaml`;
  const format = item.format !== undefined ? item.format : "yaml";

  if (isLocalRulesetLocked(item)) {
    return {
      type: "file",
      behavior,
      path,
      format,
    };
  }

  return {
    type: "http", // 远程拉取
    behavior,
    url: item.url,
    path,
    interval: item.interval !== undefined ? item.interval : 86400,
    format,
  };
}

// =============================================================================
// 辅助函数：生成远程 RULE-SET 规则行（支持 noResolve 向后兼容扩展）
// -----------------------------------------------------------------------------
// - LAN 仍然强制写死 DIRECT，避免内网流量被错误导向其它策略组
// - noResolve 仅在显式写成 false 时取消追加；其它情况全部保持当前行为
// =============================================================================
function buildRuleSetRule(item) {
  const target = item.name === "LAN" ? "DIRECT" : item.name;
  return item.noResolve === false
    ? `RULE-SET,${item.name},${target}`
    : `RULE-SET,${item.name},${target},no-resolve`;
}

// =============================================================================
// 3) 规则与规则集（rule-providers + rules）
// -----------------------------------------------------------------------------
// - 这里负责输出“真实 rules + rule-providers”，属于实际规则层，不是显示层。
// - REMOTE_RULESETS 在这里决定的是远程 RULE-SET 的真实生成顺序，也就是实际匹配顺序的一部分。
// - RULES_SKELETON 在这里提供 LAN 本地硬编码保护、国内兜底、MATCH 最终兜底。
// - CUSTOM_RULE_GROUPS 不参与这里的远程规则生成，它会在 addCustomRules() 中插回到第一条 RULE-SET 之前。
// - 最终完整匹配骨架为：
//   LAN 本地硬编码保护 -> 本地自定义规则 -> 远程规则集 -> 国内兜底 -> MATCH
// =============================================================================
function overwriteRules(config) {
  const generatedProviders = Object.fromEntries(
    REMOTE_RULESETS.map((item) => [
      item.name,
      getRemoteRulesetProviderConfig(item),
    ])
  );

  // 远程 RULE-SET 引用：严格按 REMOTE_RULESETS 的数组顺序生成。
  // 这里的顺序会进入真实 rules，因此会影响实际匹配优先级，不是单纯展示顺序。
  // 注意：LAN 仍然写死 DIRECT，避免误操作导致内网流量绕路；
  // 其余远程规则组继续指向各自同名 proxy-group，保持原语义不变。
  const remoteRuleSetRules = REMOTE_RULESETS.map((item) => buildRuleSetRule(item));

  // 最终 rules：顺序即优先级（上高下低）
  const optimizedRules = [
    ...RULES_SKELETON.localProtection,
    ...remoteRuleSetRules,
    ...RULES_SKELETON.domesticFallback,
    ...RULES_SKELETON.finalFallback,
  ];

  // 合并（保留已有 providers，再叠加生成的）
  config["rule-providers"] = {
    ...(config["rule-providers"] || {}),
    ...generatedProviders,
  };

  // 覆写 rules 为本脚本生成的版本（确保规则顺序可控）
  // 维护提示：真正进入内核执行的是这里写回的 rules，不是 proxy-groups 的显示顺序。
  config["rules"] = optimizedRules;
}

// =============================================================================
// 辅助函数：根据策略语义生成 select 组候选项
// -----------------------------------------------------------------------------
// - 该函数只负责把 DIRECT / PROXY / REJECT 语义翻译成候选顺序
// - 标准远程规则组与本地自定义规则组都会复用它
// - LAN 仍然是特例：只允许 DIRECT，防止误操作导致内网绕路
// =============================================================================
function buildPolicyGroupProxies(groupName, policy, regionGroupNames, chainEnabled) {
  if (groupName === "LAN") {
    return ["DIRECT"];
  }

  if (policy === "DIRECT") {
    return [
      "DIRECT",
      PROXY_NAME,
      ...(chainEnabled ? [CHAIN_RELAY_GROUP_NAME] : []),
      ...regionGroupNames,
    ];
  }

  if (policy === "REJECT") {
    return [
      "REJECT",
      "DIRECT",
      PROXY_NAME,
      ...(chainEnabled ? [CHAIN_RELAY_GROUP_NAME] : []),
      ...regionGroupNames,
    ];
  }

  return [
    PROXY_NAME,
    ...(chainEnabled ? [CHAIN_RELAY_GROUP_NAME] : []),
    ...regionGroupNames,
    "DIRECT",
  ];
}


// =============================================================================
// 4) 策略组（proxy-groups）生成
// -----------------------------------------------------------------------------
// 说明：
// - 这里生成的是 UI 中看到的策略组与候选项，属于“显示层 / 交互层”。
// - 它不负责真实 rules 的执行顺序；不要把 proxy-groups 的顺序误认为 rules 的匹配顺序。
// - 这里同样会读取远程规则组信息，但只用于生成可选策略组，不改写 overwriteRules() 的实际匹配顺序。
// 生成内容：
// - 地区测速组：按正则从普通节点中筛选香港/新加坡/日本/美国（仅 normalProxies 存在时生成）
// - 🌏 Auto：对普通节点做 url-test（仅 normalProxies 存在时生成，手动节点永不参与测速）
// - 链式代理（dialer-proxy）：仅当手动出口节点注入成功后生成
//   * 链路入口：有普通节点时为「🌏 Auto + normalProxies + DIRECT」；仅手动节点时退化为「DIRECT」
//   * 链路出口：仅手动节点；每个手动节点都会带 dialer-proxy 指向链路入口
//   * 📡 链式代理：普通 select 组，不再使用已被移除的 relay 类型
// - 总出口 Proxy：有普通节点时为「Auto -> (可选链式代理) -> 地区组 -> normalProxies -> DIRECT」
//                  仅手动节点时为「(可选链式代理) -> DIRECT」
// - 规则组：
//   * 标准远程规则组：按 REMOTE_RULESET_DISPLAY_ORDER 控制显示顺序
//   * 本地自定义规则组：按 CUSTOM_RULE_GROUPS 默认策略生成 select 组
// - 最后统一注入 icon：仅增强 UI 显示，不改变组结构
// =============================================================================
function overwriteProxyGroups(config) {
  // 优先使用 main() 预收集的 _allProxyNames，否则直接读取 proxies
  const allProxies = config._allProxyNames || (config["proxies"] || []).map((e) => e.name);

  const manualNames = Array.isArray(config._manualProxyNames) ? config._manualProxyNames : [];
  const manualSet = new Set(manualNames);

  // 手动节点与普通节点分层
  const manualProxies = allProxies.filter(n => manualSet.has(n));
  const normalProxies = allProxies.filter(n => !manualSet.has(n));
  const hasNormalProxies = normalProxies.length > 0;
  const hasManualProxies = manualProxies.length > 0;

  // 硬规则：只有当“最终成功注入的手动节点”>0 时，链式体系才启用
  const chainEnabled = hasManualProxies;


  // 地区测速组属于“普通节点测速组”，仅在存在 normalProxies 时生成；
  // 这里只是 UI / 交互层优化，不改变 overwriteRules() 的真实匹配顺序。
  const regionProxyGroups = hasNormalProxies
    ? regionFilterRegexs
        .map((item) => {
          const proxies = getProxiesByRegex(config, item.regex);
          return {
            name: item.name,
            type: "url-test",
            url: TEST_URL,
            interval: TEST_INTERVAL,
            tolerance: TEST_TOLERANCE,
            proxies,
            lazy: true,
          };
        })
        // 没匹配到任何节点的地区组就不生成，避免空组污染界面
        .filter((item) => item.proxies.length > 0)
    : [];

  const regionGroupNames = regionProxyGroups.map((g) => g.name);

  // 🌏 Auto 只服务普通节点测速；仅手动节点时不生成该组。
  const autoSelect = hasNormalProxies
    ? {
        name: "🌏 Auto",
        type: "url-test",
        url: TEST_URL,
        interval: TEST_INTERVAL,
        tolerance: TEST_TOLERANCE,
        proxies: [...normalProxies],
        lazy: true,
      }
    : null;

  // ---------------- 链式代理三件套（仅 chainEnabled 时生成；兼容 Clash Party / 新版 mihomo） ----------------
  const chainEntryGroup = chainEnabled
    ? {
        name: CHAIN_ENTRY_GROUP_NAME,
        type: "select",
        // 仅手动节点场景下，链式代理仍可保留，但入口只剩 DIRECT。
        proxies: hasNormalProxies ? ["🌏 Auto", ...normalProxies, "DIRECT"] : ["DIRECT"],
      }
    : null;

  const chainExitGroup = chainEnabled
    ? {
        name: CHAIN_EXIT_GROUP_NAME,
        type: "select",
        proxies: [...manualProxies], // 出口不放 DIRECT，保持语义纯净
      }
    : null;

  const chainRelayGroup = chainEnabled
    ? {
        name: CHAIN_RELAY_GROUP_NAME,
        type: "select",
        // 不再使用 type: relay。
        // 实际链路由“手动出口节点上的 dialer-proxy -> 链路入口组”完成。
        proxies: [CHAIN_EXIT_GROUP_NAME],
      }
    : null;

  // 总出口组：你最终手动选择的入口
  // 候选顺序：Auto -> (链式代理可选) -> 地区组 -> normalProxies -> DIRECT
  // 注意：这里绝不放手动节点本体（手动节点只在链式出口组里出现，并通过 dialer-proxy 使用入口组）
  const proxyGroup = {
    name: PROXY_NAME,
    type: "select",
    proxies: [
      ...(hasNormalProxies ? ["🌏 Auto"] : []),
      ...(chainEnabled ? [CHAIN_RELAY_GROUP_NAME] : []),
      ...(hasNormalProxies ? regionGroupNames : []),
      ...normalProxies,
      "DIRECT",
    ],
  };

  // 标准远程规则组：
  // - 元数据继续来自 REMOTE_RULESETS
  // - 但这里的显示顺序明确由 REMOTE_RULESET_DISPLAY_ORDER 控制
  // - 这里只影响 UI 展示，不影响 overwriteRules() 中远程 RULE-SET 的真实匹配顺序
  // 维护提示：不要把这里生成出来的 proxy-groups 顺序误认为 rules 的执行顺序。
  // 注意：各规则组只注入链式代理总开关（若启用），不注入手动节点本体
  const remoteRuleSetMap = Object.fromEntries(REMOTE_RULESETS.map((item) => [item.name, item]));
  const ruleSetProxyGroups = REMOTE_RULESET_DISPLAY_ORDER
    .map((name) => remoteRuleSetMap[name])
    .filter(Boolean)
    .map((item) => ({
      name: item.name,
      type: "select",
      proxies: buildPolicyGroupProxies(item.name, item.policy, regionGroupNames, chainEnabled),
    }));

  const customRuleProxyGroups = Object.keys(CUSTOM_RULE_GROUPS).map((ruleSetName) => {
    const defaultStrategy = CUSTOM_RULE_GROUPS[ruleSetName] && CUSTOM_RULE_GROUPS[ruleSetName].policy;

    return {
      name: ruleSetName,
      type: "select",
      proxies: buildPolicyGroupProxies(ruleSetName, defaultStrategy, regionGroupNames, chainEnabled),
    };
  });

  // 汇总写回：
  config["proxy-groups"] = [
    proxyGroup,
    autoSelect,
    ...(chainEnabled ? [chainEntryGroup, chainExitGroup, chainRelayGroup] : []),
    ...ruleSetProxyGroups,
    ...customRuleProxyGroups,
    ...regionProxyGroups,
  ].filter(Boolean);

  // 统一注入 icon（不改变 proxies/type 等逻辑）
  config["proxy-groups"] = (config["proxy-groups"] || []).map(g => {
    const icon = (CUSTOM_RULE_GROUPS[g.name] && CUSTOM_RULE_GROUPS[g.name].icon) !== undefined
      ? CUSTOM_RULE_GROUPS[g.name].icon
      : (REMOTE_RULESET_ICONS[g.name] !== undefined ? REMOTE_RULESET_ICONS[g.name] : GROUP_ICONS[g.name]);
    return icon !== undefined ? { ...g, icon } : g;
  });
}


// =============================================================================
// 5) DNS 与高级选项
// -----------------------------------------------------------------------------
// 目标：
// - fake-ip + respect-rules：让 DNS 行为与分流规则对齐，降低泄露/污染风险
// - 国内域名优先用国内 DNS（proxy-server-nameserver / nameserver-policy）
// - 非国内优先用 DoH（nameserver）提升可用性与抗污染能力
// 同时统一开启一些常用性能/体验选项（unified-delay、sniffer、tcp-concurrent 等）
// =============================================================================
function overwriteDns(config) {

  const dnsOptions = {
    "enable": true,
    "ipv6": false,
    "prefer-h3": false,

    // fake-ip：配合 sniffer / 规则，可减少 DNS 污染与泄露风险
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",

    // fake-ip-filter：这些域名/后缀不进入 fake-ip，保证局域网/系统探测正常
    "fake-ip-filter": [
      "*.lan",
      "*.local",
      "localhost",
      "localhost.*",
      "router.asus.com",
      "dns.msftncsi.com",
      "www.msftconnecttest.com",
      "time.*",
      "ntp.*",
      "id.qq.com",

      // ========== 系统连通性检测 ==========
      // Windows / macOS / Android / iOS 判断"是否联网"的探测地址
      // 拿到假 IP → 系统误判为"无网络"，状态栏显示无连接
      "+.msftconnecttest.com",
      "+.msftncsi.com",
      "captive.apple.com",
      "connectivitycheck.gstatic.com",
      "detectportal.firefox.com",

      // ========== NTP 时间同步 ==========
      // 假 IP → 校时失败 → 系统时间偏移 → 证书验证出错
      "time.windows.com",
      "time.apple.com",
      "time.android.com",
      "pool.ntp.org",
      "+.pool.ntp.org",

      // ========== 局域网设备（NAS / 打印机 / 路由器） ==========
      "+.synology.com",
      "+.tplinkwifi.net",
      "melogin.cn",
      "falogin.cn",
      "+.nip.io",
    ],

    // default-nameserver：用于 bootstrap（避免 DoH 首次解析失败）
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],

    // nameserver：主要解析器（这里使用 DoH）
    "nameserver": trustDnsList,

    // proxy-server-nameserver：当需要为代理服务器域名解析时使用（通常走国内 DNS 更稳）
    "proxy-server-nameserver": cnDnsList,

    // respect-rules：让 DNS 行为尊重分流规则，减少“解析走代理/请求走直连”等错配
    "respect-rules": true,

    // nameserver-policy：按 geosite 分类选择解析器（国内用国内 DNS，国外用 DoH）
    "nameserver-policy": {
      "geosite:cn": cnDnsList,
      "geosite:geolocation-!cn": trustDnsList,
    },
  };

  // 写回 DNS 与其它选项（尽量合并，不破坏原有字段）
  config.dns = { ...config.dns, ...dnsOptions };
}


function overwriteMiscOptions(config) {
  // Geo 数据库下载地址（geodata-mode + geox-url）
  // - 用于 GEOSITE/GEOIP 等匹配能力
  const geoxURLs = {
    "geoip": "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip-lite.dat",
    "geosite": "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
    "mmdb": "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country-lite.mmdb",
  };

  // 其它常用体验/性能选项
  const otherOptions = {
    "unified-delay": true,      // 统一延迟显示逻辑（体验更一致）
    "tcp-concurrent": true,     // TCP 并发连接（提升部分场景体验）
    "profile": { "store-selected": true, "store-fake-ip": true },

    // sniffer：嗅探 SNI/HTTP Host，提升 fake-ip 模式下的可用性
    "sniffer": {
      "enable": true,
      "sniff": {
        "TLS": { "ports": [443, 8443] },
        "HTTP": { "ports": [80, "8080-8880"], "override-destination": true }
      },
      "skip-domain": [
        "Mijia Cloud",
        "+.apple.com",
        "+.icloud.com",
        "+.wechat.com",
        "+.qq.com",
        "+.qpic.cn",
        "+.vivox.com",
        "+.oray.com",
        "+.sunlogin.net"
      ]
    },

    // geodata-mode：启用 geosite/geoip 数据库能力
    "geodata-mode": true,

    // geox-url：指定 geosite/geoip/mmdb 下载地址
    "geox-url": geoxURLs,
  };

  Object.keys(otherOptions).forEach((key) => { config[key] = otherOptions[key]; });
}


// =============================================================================
// 辅助函数：按正则筛选节点名（默认排除手动节点）
// -----------------------------------------------------------------------------
// - 优先使用 main() 预收集的 _allProxyNames，否则直接读取 proxies
// - 默认排除"手动节点"：手动节点语义是"链式出口"，不参与地区测速/Auto 测速
// =============================================================================
function getProxiesByRegex(config, regex) {
  const names = config._allProxyNames || (config.proxies || []).map((e) => e.name);
  const manualNames = Array.isArray(config._manualProxyNames) ? config._manualProxyNames : [];
  const manualSet = new Set(manualNames);

  const base = manualNames.length > 0
    ? names.filter(n => !manualSet.has(n))
    : names;

  return base.filter((name) => regex.test(name));
}