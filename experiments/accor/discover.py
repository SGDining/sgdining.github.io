#!/usr/bin/env python3
# Isolated probe only; production data is not modified by this script.
from __future__ import annotations
import json, re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

URL='https://restaurantsandbars.accor.com/en/singapore/singapore/map'
OUT=Path('experiments/accor/discovery.json')


def norm_url(href:str)->str:
    href=(href or '').strip()
    if href.startswith('/'):
        return 'https://restaurantsandbars.accor.com'+href
    return href


def main()->int:
    json_responses=[]
    response_urls=[]
    search_payloads=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(headless=True)
        context=browser.new_context(
            locale='en-SG',
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
            viewport={'width':1440,'height':1000},
        )
        page=context.new_page()
        def on_response(resp):
            u=resp.url
            if any(k in u.lower() for k in ('restaurant','search','map','venue','poi','location')):
                response_urls.append(u)
            try:
                ctype=(resp.headers.get('content-type') or '').lower()
                if 'application/json' in ctype:
                    data=resp.json()
                    json_responses.append({'url':u,'data':data})
                    if 'operationName=SearchRestaurants' in u:
                        search_payloads.append({'url':u,'data':data})
            except Exception:
                pass
        page.on('response', on_response)
        page.goto(URL, wait_until='domcontentloaded', timeout=90000)
        page.wait_for_timeout(12000)
        body=(page.locator('body').inner_text(timeout=10000) or '')
        title=page.title()
        if 'verify that you' in body.lower() and 'robot' in body.lower():
            raise RuntimeError('Accor map remained on anti-bot verification page in browser')
        for _ in range(8):
            page.mouse.wheel(0, 1600)
            page.wait_for_timeout(500)
        anchors=page.locator('a[href]').evaluate_all("els => els.map(a => ({text:(a.innerText||a.textContent||'').trim(), href:a.href}))")
        browser.close()

    links=[]
    seen=set()
    for a in anchors:
        href=norm_url(a.get('href',''))
        text=re.sub(r'\s+',' ',a.get('text','')).strip()
        if not href.startswith('http'): continue
        host=urlparse(href).netloc.lower()
        path=urlparse(href).path.lower()
        if 'restaurantsandbars.accor.com' not in host: continue
        if '/en/singapore/singapore' not in path: continue
        if path.rstrip('/').endswith('/map'): continue
        key=(text.lower(),href)
        if key in seen: continue
        seen.add(key)
        links.append({'text':text,'url':href})

    json_diag=[]
    for item in json_responses[:30]:
        d=item['data']
        if isinstance(d,dict): shape={'type':'dict','keys':list(d.keys())[:30]}
        elif isinstance(d,list): shape={'type':'list','length':len(d),'sample_type':type(d[0]).__name__ if d else None}
        else: shape={'type':type(d).__name__}
        json_diag.append({'url':item['url'],'shape':shape})

    out={
        'source':URL,
        'title':title,
        'body_prefix':body[:1200],
        'official_singapore_links':links,
        'official_singapore_link_count':len(links),
        'candidate_network_urls':sorted(set(response_urls))[:100],
        'json_responses':json_diag,
        'search_restaurants':search_payloads,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'title':title,'links':len(links),'network_candidates':len(set(response_urls)),'json_responses':len(json_responses),'search_payloads':len(search_payloads)},indent=2))
    if not search_payloads:
        raise RuntimeError('Accor SearchRestaurants structured payload was not captured')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
