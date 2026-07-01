import type { AccountProfile } from "@saegim/domain";

type AnalyticsPrimitive = string | number | boolean | null;
type AnalyticsValue = AnalyticsPrimitive | AnalyticsPrimitive[];
export type AnalyticsProperties = Record<
  string,
  AnalyticsValue | undefined
>;
type CleanAnalyticsProperties = Record<string, AnalyticsValue>;
type MixpanelPeopleQueue = unknown[] & {
  set?: (properties: CleanAnalyticsProperties) => void;
} & Record<string, unknown>;
type MixpanelQueue = unknown[] & {
  __SV?: number;
  _i?: unknown[][];
  identify?: (accountId: string) => void;
  init?: (...args: unknown[]) => void;
  people?: MixpanelPeopleQueue;
  register?: (properties: CleanAnalyticsProperties) => void;
  reset?: () => void;
  track?: (eventName: string, properties?: CleanAnalyticsProperties) => void;
  track_pageview?: (properties?: CleanAnalyticsProperties) => void;
} & Record<string, unknown>;

declare global {
  interface Window {
    mixpanel?: MixpanelQueue;
  }
}

const mixpanelToken = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN?.trim() ?? "";
const mixpanelEnabled =
  process.env.NEXT_PUBLIC_MIXPANEL_ENABLED?.trim().toLowerCase() ?? "";
const mixpanelDebug =
  process.env.NEXT_PUBLIC_MIXPANEL_DEBUG?.trim().toLowerCase() === "true";
const mixpanelApiHost =
  process.env.NEXT_PUBLIC_MIXPANEL_API_HOST?.trim() || undefined;
const mixpanelLibraryUrl =
  process.env.NEXT_PUBLIC_MIXPANEL_LIB_URL?.trim() ||
  "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";

let isInitialized = false;
let identifiedAccountId: string | null = null;

export function trackAnalyticsPageView(
  pageName: string,
  properties: AnalyticsProperties = {},
) {
  const mixpanel = ensureMixpanel();
  if (!mixpanel) return;

  const nextProperties = makeAnalyticsProperties({
    page_name: pageName,
    ...properties,
  });

  mixpanel.track?.("Page Viewed", nextProperties);

  if (typeof mixpanel.track_pageview === "function") {
    mixpanel.track_pageview(nextProperties);
  }
}

export function trackAnalyticsEvent(
  eventName: string,
  properties: AnalyticsProperties = {},
) {
  const mixpanel = ensureMixpanel();
  if (!mixpanel) return;

  mixpanel.track?.(eventName, makeAnalyticsProperties(properties));
}

export function identifyAnalyticsAccount(account: AccountProfile) {
  if (!isTrackableAccount(account)) return;

  const mixpanel = ensureMixpanel();
  if (!mixpanel) return;

  if (identifiedAccountId !== account.id) {
    mixpanel.identify?.(account.id);
    identifiedAccountId = account.id;
  }

  const accountProperties = makeAnalyticsProperties({
    account_id: account.id,
    handle: account.handle,
    verification: account.verification,
    post_count: account.postCount,
    writing_friend_count: account.writingFriendCount,
    signed_in: true,
  });

  mixpanel.register?.(accountProperties);
  mixpanel.people?.set?.(accountProperties);
}

export function resetAnalyticsIdentity() {
  const mixpanel = ensureMixpanel();
  if (!mixpanel) return;

  mixpanel.reset?.();
  identifiedAccountId = null;
}

function ensureMixpanel() {
  if (!canTrackAnalytics()) return null;

  const mixpanel = installMixpanelQueue();
  if (!mixpanel) return null;

  if (!isInitialized) {
    const config: Record<string, unknown> = {
      autocapture: false,
      debug: mixpanelDebug,
      track_pageview: false,
    };

    if (mixpanelApiHost) {
      config.api_host = mixpanelApiHost;
    }

    mixpanel.init?.(mixpanelToken, config);
    mixpanel.register?.(
      makeAnalyticsProperties({
        app: "saegim",
        source: "web",
      }),
    );
    isInitialized = true;
  }

  return mixpanel;
}

function canTrackAnalytics() {
  if (!mixpanelToken) return false;
  return ["1", "true", "on", "yes"].includes(mixpanelEnabled);
}

function installMixpanelQueue() {
  if (typeof window === "undefined") return null;

  if (window.mixpanel?.__SV) {
    return window.mixpanel;
  }

  const mixpanel = (window.mixpanel ?? []) as MixpanelQueue;
  window.mixpanel = mixpanel;
  mixpanel._i = mixpanel._i ?? [];
  mixpanel.__SV = 1.2;
  mixpanel.init = (...args: unknown[]) => {
    const name = typeof args[2] === "string" ? args[2] : "mixpanel";
    const target =
      name === "mixpanel"
        ? mixpanel
        : (((mixpanel[name] as MixpanelQueue | undefined) ?? []) as MixpanelQueue);

    if (name !== "mixpanel") {
      mixpanel[name] = target;
    }

    target.people =
      (target.people as MixpanelPeopleQueue | undefined) ??
      ([] as unknown[] as MixpanelPeopleQueue);

    queueMethods.forEach((methodName) => addQueuedMethod(target, methodName));
    mixpanel._i?.push([args[0], args[1], name]);
  };

  const script = document.createElement("script");
  script.async = true;
  script.src = mixpanelLibraryUrl;

  const firstScript = document.getElementsByTagName("script")[0];
  if (firstScript?.parentNode) {
    firstScript.parentNode.insertBefore(script, firstScript);
  } else {
    document.head.appendChild(script);
  }

  return mixpanel;
}

const queueMethods = [
  "disable",
  "time_event",
  "track",
  "track_pageview",
  "register",
  "register_once",
  "alias",
  "unregister",
  "identify",
  "name_tag",
  "set_config",
  "reset",
  "opt_in_tracking",
  "opt_out_tracking",
  "has_opted_in_tracking",
  "has_opted_out_tracking",
  "clear_opt_in_out_tracking",
  "start_batch_senders",
  "people.set",
  "people.set_once",
  "people.unset",
  "people.increment",
  "people.append",
  "people.union",
  "people.track_charge",
  "people.clear_charges",
  "people.delete_user",
  "people.remove",
] as const;

function addQueuedMethod(target: MixpanelQueue, methodName: string) {
  const parts = methodName.split(".");

  if (parts.length === 2) {
    const groupName = parts[0]!;
    const nestedMethodName = parts[1]!;
    const group =
      ((target[groupName] as MixpanelPeopleQueue | undefined) ??
        ([] as unknown[] as MixpanelPeopleQueue));
    target[groupName] = group;
    group[nestedMethodName] = (...args: unknown[]) => {
      group.push([nestedMethodName, ...args]);
      return group;
    };
    return;
  }

  target[methodName] = (...args: unknown[]) => {
    target.push([methodName, ...args]);
    return target;
  };
}

function makeAnalyticsProperties(
  properties: AnalyticsProperties = {},
): CleanAnalyticsProperties {
  return sanitizeAnalyticsProperties({
    app: "saegim",
    environment: process.env.NODE_ENV ?? "development",
    pathname: currentPathname(),
    source: "web",
    ...properties,
  });
}

function sanitizeAnalyticsProperties(
  properties: AnalyticsProperties,
): CleanAnalyticsProperties {
  const cleanProperties: CleanAnalyticsProperties = {};

  Object.entries(properties).forEach(([key, value]) => {
    const normalizedValue = normalizeAnalyticsValue(value);
    if (typeof normalizedValue === "undefined") return;

    cleanProperties[key] = normalizedValue;
  });

  return cleanProperties;
}

function normalizeAnalyticsValue(
  value: AnalyticsProperties[string],
): AnalyticsValue | undefined {
  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (value === null) {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAnalyticsValue(item))
      .filter((item): item is AnalyticsPrimitive => {
        return typeof item !== "undefined" && !Array.isArray(item);
      });
  }

  return undefined;
}

function currentPathname() {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function isTrackableAccount(account: AccountProfile) {
  return account.id !== "guest";
}
