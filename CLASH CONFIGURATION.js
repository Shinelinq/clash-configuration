// ⚠️ 本脚本仅适用于 Clash Meta (mihomo) 内核
// 0) 全局常量与策略字典
// 主要配置均在本区修改：总出口、测速、DNS、手动节点、规则集、显示顺序和自定义规则。

// 总出口：MATCH 及选择 PROXY 的规则组最终指向这里。
const PROXY_NAME = "Proxy";

// url-test / Auto 健康检查：地址、周期（秒）和延迟容差（ms）。
const TEST_URL = "https://cp.cloudflare.com/generate_204";
const TEST_INTERVAL = 600;
const TEST_TOLERANCE = 50;

// 国内 DoH：用于国内域名的加密解析。
const cnDnsList = [
  "https://223.5.5.5/dns-query",
  "https://1.12.12.12/dns-query",
];

// 可信 DoH：用于国际域名解析，降低污染概率
const trustDnsList = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/dns-query",
  "https://1.1.1.1/dns-query",
  "https://8.8.4.4/dns-query",
];

// 私有域名 DNS：用于解析局域网、家庭或公司内部自定义域名。
// 默认留空，不改变现有 DNS 行为；需要时可填写路由器或内部 DNS。
// 示例：const PRIVATE_DNS_LIST = ["192.168.1.1"];
const PRIVATE_DNS_LIST = [];

// 手动节点（链式代理出口）
// 普通订阅节点作为入口，MANUAL_PROXIES 注入 config.proxies 后作为出口。
// 新版 mihomo 不使用 relay；手动节点通过 dialer-proxy 指向入口组。
// 只有至少一个手动节点成功注入时，才生成链式策略组。
const MANUAL_RENAME_SUFFIX = " (Manual)";

// 在此维护手动节点；为空时不生成入口、出口和链式代理组。
// const MANUAL_PROXIES = [
  // trojan 示例
  // {
  //   name: "名字",
  //   type: "trojan",
  //   server: "域名或IP",
  //   port: 443,
  //   password: "密码",
  //   sni: "域名",
  //   udp: true,
  // },

  // socks5 示例
  // {
  //   name: "名字",
  //   type: "socks5",
  //   server: "IP",
  //   port: 1080,
  //   username: "用户名",
  //   password: "密码",
  //   udp: true,
  // },

  // ss 示例
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

// 链式代理（dialer-proxy）分组名
// - CHAIN_ENTRY_GROUP_NAME：链路入口（中转节点）：Auto + 普通节点 + DIRECT
// - CHAIN_EXIT_GROUP_NAME：链路出口：仅手动节点，不含 DIRECT
// - CHAIN_RELAY_GROUP_NAME：链式代理总开关（select）：指向出口组；出口节点通过 dialer-proxy 使用入口组拨号
const CHAIN_ENTRY_GROUP_NAME = "链路入口（中转节点）";
const CHAIN_EXIT_GROUP_NAME = "链路出口（手动添加）";
const CHAIN_RELAY_GROUP_NAME = "📡 链式代理";

// 规则职责：REMOTE_RULESETS 管理远程规则，RULES_SKELETON 管理保护与兜底，
// CUSTOM_RULE_GROUPS 管理本地规则。最终顺序固定为：
// LAN 本地保护 -> 本地自定义规则 -> 远程规则集 -> 国内兜底 -> MATCH。

// 标准远程规则组
// name 同时用于 rule-provider、RULE-SET 和 proxy-group；policy 为 UI 默认倾向。
// 数组顺序决定远程规则的真实匹配优先级；UI 顺序由 REMOTE_RULESET_DISPLAY_ORDER 控制。
// 可选 behavior/format/interval/path/noResolve 字段未填写时使用既有默认值。
// 新增规则组先改这里；需要在 UI 显示时再同步修改 REMOTE_RULESET_DISPLAY_ORDER。
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

// 远程规则本地锁定名单
// 填写 REMOTE_RULESETS 中完全一致的 name 后，provider 改读默认路径
// ./ruleset/${name}.yaml；无效名称会忽略。锁定前必须先成功缓存一次。
// 更新时先移出名单，远程更新完成后再加入。
// 示例：const LOCAL_RULESET_LOCK_NAMES = ["OpenAI", "Grok"];
const LOCAL_RULESET_LOCK_NAMES = [];
const LOCAL_RULESET_LOCK_NAME_SET = new Set(
  LOCAL_RULESET_LOCK_NAMES.filter((name) =>
    REMOTE_RULESETS.some((item) => item.name === name)
  )
);

// 远程规则组显示顺序：只影响 proxy-groups 的 UI 顺序，不影响 rule-provider
// 或 RULE-SET 的真实顺序；无效名称会忽略。新增远程组需要显示时在此补充。
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

// 规则骨架：系统保护与兜底，不属于远程规则组。
// LAN 本地保护、国内兜底和 MATCH 在此修改。
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

// 分组图标：仅影响 UI；key 必须与 proxy-group 名完全一致。
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

// 本地自定义规则组：在此维护规则及对应策略组元数据。
// addCustomRules() 将其插入第一条远程 RULE-SET 前，优先级低于 LAN 保护、
// 高于全部远程规则；不参与 rule-provider 或系统兜底生成。
const CUSTOM_RULE_GROUPS = {
  "linux.do": {
    policy: "PROXY",
    icon: "https://linux.do/uploads/default/original/3X/9/d/9dd49731091ce8656e94433a26a3ef36062b3994.png",
    rules: [
      "DOMAIN-SUFFIX,linux.do"
    ]
  },

  // 新增自定义规则组只需在此添加，无需修改函数：
  // "example.com": {
  //   policy: "DIRECT",
  //   icon: "图标URL",
  //   rules: [
  //     "DOMAIN-SUFFIX,example.com",
  //     "DOMAIN,sub.example.com"
  //   ]
  // }
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

// 1) 主流程与代理名收集
// 客户端通常先把订阅节点解析到 config.proxies；同时遍历 proxy-providers 以备兼容，
// 但其节点在脚本执行时通常尚未加载。
function getAllProxyNames(config){
  const names = [];

  if (Array.isArray(config.proxies) && config.proxies.length) {
    names.push(...config.proxies.map(p => p && p.name).filter(Boolean));
  }

  const providers = config["proxy-providers"] || {};
  for (const key of Object.keys(providers)) {
    const p = providers[key];
    if (Array.isArray(p.proxies)) {
      names.push(...p.proxies.map(x => x && x.name).filter(Boolean));
    }
  }

  return [...new Set(names)];
}

// 手动节点仅校验必要字段，避免协议差异被过度校验误伤。
function isValidManualProxy(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (!raw.name) return false;
  if (!raw.type) return false;
  if (!raw.server) return false;
  if (raw.port === undefined || raw.port === null || raw.port === "") return false;
  return true;
}

// 主入口：生成真实规则、UI 策略组、DNS 和高级选项。
// addCustomRules() 虽最后调用，仍会把本地规则插入第一条远程 RULE-SET 前。
// 任何异常均回退到原始配置。
function main(config) {
  if (!config || typeof config !== "object") return config || {};

  // 备份原始配置，避免异常时返回已被部分修改的对象。
  let backup;
  try {
    backup = JSON.parse(JSON.stringify(config));
  } catch (_) {
    backup = config;
  }

  try {
    // A. 注入手动出口节点。
    if (!Array.isArray(config.proxies)) config.proxies = [];
    const manualNames = [];

    if (Array.isArray(MANUAL_PROXIES) && MANUAL_PROXIES.length > 0) {
      const existingNames = new Set(getAllProxyNames(config));

      for (const raw of MANUAL_PROXIES) {
        if (!isValidManualProxy(raw)) continue;

        const p = { ...raw };

        // 手动节点撞名时稳定追加后缀。
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

        // mihomo 链式出口使用 dialer-proxy，不使用 relay。
        p["dialer-proxy"] = CHAIN_ENTRY_GROUP_NAME;

        existingNames.add(finalName);
        manualNames.push(finalName);
        config.proxies.push(p);
      }
    }

    // 临时字段供节点分层、测速排除和链式组生成使用。
    config._manualProxyNames = manualNames;

    // B. 收集全部节点名。
    const allProxies = getAllProxyNames(config);

    if (!allProxies.length) {
      delete config._manualProxyNames;
      return config;
    }

    config._allProxyNames = allProxies;

    // C. 按既定顺序加工配置。
    overwriteRules(config);
    overwriteProxyGroups(config);
    overwriteDns(config);
    overwriteMiscOptions(config);
    addCustomRules(config);

    // 清理内部临时字段。
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


// 2) 本地自定义规则：插入第一条远程 RULE-SET 前、LAN 保护后。
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
  // 按第一条 RULE-SET 的位置回插，与 main() 调用先后无关。
  const insertIndex = rules.findIndex(r => typeof r === "string" && r.startsWith("RULE-SET,"));
  if (insertIndex >= 0) {
    rules.splice(insertIndex, 0, ...customRules);
    config["rules"] = rules;
  } else {
    config["rules"] = [...customRules, ...rules];
  }
}


// 将 REMOTE_RULESETS 项转换为 provider；扩展字段缺省时沿用默认值。
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
    type: "http",
    behavior,
    url: item.url,
    path,
    interval: item.interval !== undefined ? item.interval : 86400,
    format,
  };
}

// 生成远程 RULE-SET；LAN 固定 DIRECT，noResolve 仅 false 时取消追加。
function buildRuleSetRule(item) {
  const target = item.name === "LAN" ? "DIRECT" : item.name;
  return item.noResolve === false
    ? `RULE-SET,${item.name},${target}`
    : `RULE-SET,${item.name},${target},no-resolve`;
}

// 3) 真实规则与 rule-providers
// REMOTE_RULESETS 数组顺序决定远程 RULE-SET 的真实匹配顺序。
function overwriteRules(config) {
  const generatedProviders = Object.fromEntries(
    REMOTE_RULESETS.map((item) => [
      item.name,
      getRemoteRulesetProviderConfig(item),
    ])
  );

  // 严格按 REMOTE_RULESETS 顺序生成；LAN 固定指向 DIRECT。
  const remoteRuleSetRules = REMOTE_RULESETS.map((item) => buildRuleSetRule(item));

  // 本地自定义规则稍后插入 localProtection 与 remoteRuleSetRules 之间。
  const optimizedRules = [
    ...RULES_SKELETON.localProtection,
    ...remoteRuleSetRules,
    ...RULES_SKELETON.domesticFallback,
    ...RULES_SKELETON.finalFallback,
  ];

  config["rule-providers"] = {
    ...(config["rule-providers"] || {}),
    ...generatedProviders,
  };

  config["rules"] = optimizedRules;
}

// 按 DIRECT / PROXY / REJECT 语义生成候选项；LAN 仅允许 DIRECT。
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


// 4) UI 策略组
// Auto 和地区测速仅使用普通节点，手动节点不参与；链式组仅在手动出口成功注入时生成。
// 链路入口为 Auto/普通节点/DIRECT，链路出口仅含手动节点并通过 dialer-proxy 拨号。
// 标准远程组按 REMOTE_RULESET_DISPLAY_ORDER 显示；此处顺序不等于 rules 匹配顺序。
function overwriteProxyGroups(config) {
  // 优先使用 main() 预收集结果。
  const allProxies = config._allProxyNames || (config["proxies"] || []).map((e) => e.name);

  const manualNames = Array.isArray(config._manualProxyNames) ? config._manualProxyNames : [];
  const manualSet = new Set(manualNames);

  const manualProxies = allProxies.filter(n => manualSet.has(n));
  const normalProxies = allProxies.filter(n => !manualSet.has(n));
  const hasNormalProxies = normalProxies.length > 0;
  const hasManualProxies = manualProxies.length > 0;

  const chainEnabled = hasManualProxies;

  // 地区测速组仅使用普通节点；空组不生成。
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
        .filter((item) => item.proxies.length > 0)
    : [];

  const regionGroupNames = regionProxyGroups.map((g) => g.name);

  // Auto 仅使用普通节点。
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

  // 链式代理三组，仅 chainEnabled 时生成。
  const chainEntryGroup = chainEnabled
    ? {
        name: CHAIN_ENTRY_GROUP_NAME,
        type: "select",
        proxies: hasNormalProxies ? ["🌏 Auto", ...normalProxies, "DIRECT"] : ["DIRECT"],
      }
    : null;

  const chainExitGroup = chainEnabled
    ? {
        name: CHAIN_EXIT_GROUP_NAME,
        type: "select",
        proxies: [...manualProxies],
      }
    : null;

  const chainRelayGroup = chainEnabled
    ? {
        name: CHAIN_RELAY_GROUP_NAME,
        type: "select",
        // select 指向出口组；实际链路由手动节点的 dialer-proxy 完成。
        proxies: [CHAIN_EXIT_GROUP_NAME],
      }
    : null;

  // 总出口候选顺序：Auto -> 链式代理 -> 地区组 -> 普通节点 -> DIRECT。
  // 手动节点本体只出现在链式出口组。
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

  // 远程组按独立 UI 顺序生成，只注入链式总开关，不注入手动节点本体。
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

  config["proxy-groups"] = [
    proxyGroup,
    autoSelect,
    ...(chainEnabled ? [chainEntryGroup, chainExitGroup, chainRelayGroup] : []),
    ...ruleSetProxyGroups,
    ...customRuleProxyGroups,
    ...regionProxyGroups,
  ].filter(Boolean);

  // 统一注入图标，不改变组结构。
  config["proxy-groups"] = (config["proxy-groups"] || []).map(g => {
    const icon = (CUSTOM_RULE_GROUPS[g.name] && CUSTOM_RULE_GROUPS[g.name].icon) !== undefined
      ? CUSTOM_RULE_GROUPS[g.name].icon
      : (REMOTE_RULESET_ICONS[g.name] !== undefined ? REMOTE_RULESET_ICONS[g.name] : GROUP_ICONS[g.name]);
    return icon !== undefined ? { ...g, icon } : g;
  });
}


// 5) DNS 与高级选项
// fake-ip + respect-rules 使解析与分流一致；国内域名及代理服务器使用国内 DoH，
// 其他域名使用可信 DoH，以减少绕路、泄露和污染。
function overwriteDns(config) {
  const dnsOptions = {
    "enable": true,
    "ipv6": false,
    "prefer-h3": false,

    // fake-ip 配合 sniffer 和规则。
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",

    // 保证局域网、连通性检测和时间同步正常。
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

      // 系统连通性检测
      "+.msftconnecttest.com",
      "+.msftncsi.com",
      "captive.apple.com",
      "connectivitycheck.gstatic.com",
      "detectportal.firefox.com",

      // NTP 时间同步
      "time.windows.com",
      "time.apple.com",
      "time.android.com",
      "pool.ntp.org",
      "+.pool.ntp.org",

      // 局域网设备
      "+.synology.com",
      "+.tplinkwifi.net",
      "melogin.cn",
      "falogin.cn",
      "+.nip.io",
    ],

    // 负责 DoH 初始化和基础解析。
    "default-nameserver": cnDnsList,

    // 可信 DoH。
    "nameserver": trustDnsList,

    // 代理服务器域名使用国内 DoH。
    "proxy-server-nameserver": cnDnsList,

    // 未被 nameserver-policy 明确分类、最终走 DIRECT 的域名使用国内 DoH。
    // nameserver-policy 仍具有更高优先级。
    "direct-nameserver": cnDnsList,
    "direct-nameserver-follow-policy": true,

    // 解析遵循分流规则。
    "respect-rules": true,

    // 国内域名用国内加密 DNS，其他域名用可信 DoH。
    "nameserver-policy": {
      // 仅在用户配置私有 DNS 时启用，不影响默认行为。
      ...(Array.isArray(PRIVATE_DNS_LIST) && PRIVATE_DNS_LIST.length > 0
        ? {
            "geosite:private": PRIVATE_DNS_LIST,
            "+.lan": PRIVATE_DNS_LIST,
            "+.local": PRIVATE_DNS_LIST,
            "+.home.arpa": PRIVATE_DNS_LIST,
          }
        : {}),

      "geosite:cn": cnDnsList,
      "geosite:geolocation-!cn": trustDnsList,
    },
  };

  config.dns = { ...config.dns, ...dnsOptions };
}


function overwriteMiscOptions(config) {
  // GEOSITE/GEOIP 数据库地址。
  const geoxURLs = {
    "geoip": "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip-lite.dat",
    "geosite": "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat",
    "mmdb": "https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/country-lite.mmdb",
  };

  const otherOptions = {
    "unified-delay": true,
    "tcp-concurrent": true,
    "profile": { "store-selected": true, "store-fake-ip": true },

    // 嗅探 SNI/HTTP Host，配合 fake-ip。
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

    "geodata-mode": true,
    "geox-url": geoxURLs,
  };

  Object.keys(otherOptions).forEach((key) => { config[key] = otherOptions[key]; });
}


// 按正则筛选普通节点；手动出口不参与地区或 Auto 测速。
function getProxiesByRegex(config, regex) {
  const names = config._allProxyNames || (config.proxies || []).map((e) => e.name);
  const manualNames = Array.isArray(config._manualProxyNames) ? config._manualProxyNames : [];
  const manualSet = new Set(manualNames);

  const base = manualNames.length > 0
    ? names.filter(n => !manualSet.has(n))
    : names;

  return base.filter((name) => regex.test(name));
}
