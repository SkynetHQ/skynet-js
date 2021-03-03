import { addUrlQuery, defaultSkynetPortalUrl, getFullDomainUrlForPortal, getDomainForPortal, makeUrl } from "./url";

const portalUrl = defaultSkynetPortalUrl;
const skylink = "XABvi7JtJbQSMAcDwnUnmp2FKDPjg8_tTTFP4BwMSxVdEg";
const skylinkBase32 = "bg06v2tidkir84hg0s1s4t97jaeoaa1jse1svrad657u070c9calq4g";
const domains = [
  ["dac.hns", "https://dac.hns.siasky.net"],
  [skylinkBase32, `https://${skylinkBase32}.siasky.net`],
];

describe("addUrlQuery", () => {
  it("should return correctly formed URLs with query parameters", () => {
    expect(addUrlQuery(portalUrl, { filename: "test" })).toEqual(`${portalUrl}?filename=test`);
    expect(addUrlQuery(`${portalUrl}/path/`, { download: true })).toEqual(`${portalUrl}/path/?download=true`);
    expect(addUrlQuery(`${portalUrl}/skynet/`, { foo: 1, bar: 2 })).toEqual(`${portalUrl}/skynet/?foo=1&bar=2`);
    expect(addUrlQuery(`${portalUrl}/`, { attachment: true })).toEqual(`${portalUrl}/?attachment=true`);
    expect(addUrlQuery(`${portalUrl}?foo=bar`, { attachment: true })).toEqual(`${portalUrl}?foo=bar&attachment=true`);
    expect(addUrlQuery(`${portalUrl}/?attachment=true`, { foo: "bar" })).toEqual(
      `${portalUrl}/?attachment=true&foo=bar`
    );
    expect(addUrlQuery(`${portalUrl}#foobar`, { foo: "bar" })).toEqual(`${portalUrl}?foo=bar#foobar`);
  });
});

describe("getFullDomainUrlForPortal", () => {
  it.each(domains)("domain %s should return correctly formed full URL %s", (domain, fullUrl) => {
    const url = getFullDomainUrlForPortal(portalUrl, domain);
    expect(url).toEqual(fullUrl);
  });
});

describe("getDomainForPortal", () => {
  it.each(domains)("should extract domain %s out of full url %s", (domain, fullUrl) => {
    const receivedDomain = getDomainForPortal(portalUrl, fullUrl);
    expect(receivedDomain).toEqual(domain);
  });
});

describe("makeUrl", () => {
  it("should return correctly formed URLs", () => {
    expect(makeUrl(portalUrl, "/")).toEqual(`${portalUrl}/`);
    expect(makeUrl(portalUrl, "/skynet")).toEqual(`${portalUrl}/skynet`);
    expect(makeUrl(portalUrl, "/skynet/")).toEqual(`${portalUrl}/skynet/`);

    expect(makeUrl(portalUrl, "/", skylink)).toEqual(`${portalUrl}/${skylink}`);
    expect(makeUrl(portalUrl, "/skynet", skylink)).toEqual(`${portalUrl}/skynet/${skylink}`);
    expect(makeUrl(portalUrl, "//skynet/", skylink)).toEqual(`${portalUrl}/skynet/${skylink}`);
    expect(makeUrl(portalUrl, "/skynet/", `${skylink}?foo=bar`)).toEqual(`${portalUrl}/skynet/${skylink}?foo=bar`);
    expect(makeUrl(portalUrl, `${skylink}/?foo=bar`)).toEqual(`${portalUrl}/${skylink}?foo=bar`);
    expect(makeUrl(portalUrl, `${skylink}#foobar`)).toEqual(`${portalUrl}/${skylink}#foobar`);
  });
});
