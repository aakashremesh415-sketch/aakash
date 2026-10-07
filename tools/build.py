"""Build index.html from src/.

The FAQ lives once in src/faq.json and is rendered both as visible <details>
blocks and as FAQPage structured data, so the two can never drift apart.

Usage: python3 tools/build.py
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
SITE = "https://aakashremesh.com"
PERSON_ID = f"{SITE}/#person"

UPWORK = "https://www.upwork.com/freelancers/~01dfe8e2fc663ed9ec"
LINKEDIN = "https://www.linkedin.com/in/aakashremesh/"

faq = json.loads((SRC / "faq.json").read_text())

SERVICES = [
    ("Accounting System Setup", "Chart of Accounts, opening balances, bank feeds and integrations configured from scratch in QuickBooks Online, Zoho Books, Xero, Sage Intacct or NetSuite."),
    ("Accounting Platform Migration", "End-to-end migrations from QuickBooks Desktop, Xero or spreadsheets to cloud accounting, with opening balances validated and history reconciled."),
    ("eCommerce Payout Reconciliation", "Shopify Payments, Amazon, PayPal and Stripe payouts reconciled through A2X and MyWorks, including fees, refunds, reserves and COGS."),
    ("Multi-Entity and Intercompany Accounting", "Due-to/due-from accounts, intercompany eliminations and consolidated reporting for groups with several entities."),
    ("Inventory Accounting", "BOMs, assemblies, COGS tracking and landed costs for manufacturers, wholesalers and dropshippers."),
    ("Month-End Close, Cleanup and Reporting", "Month-end close, catch-up and cleanup projects, SaaS deferred revenue, and Excel MIS models and dashboards."),
]

CREDENTIALS = [
    ("QuickBooks Online Certification, Level 2", "Intuit", None),
    ("Intuit Enterprise Suite Certification", "Intuit", None),
    ("Intuit Bookkeeping Certification", "Intuit", None),
    ("QuickBooks ProAdvisor Academy, Level 1", "Intuit", "2025-05-21"),
    ("Certified Zoho Books Associate", "Zoho Corporation", "2026-05-07"),
    ("Xero Advisor Certification", "Xero", "2024-04-16"),
    ("Career Essentials in Data Analysis", "Microsoft and LinkedIn", "2023-12-14"),
]

AREAS = [
    {"@type": "Country", "name": "United States"},
    {"@type": "Country", "name": "India"},
    {"@type": "Country", "name": "New Zealand"},
    {"@type": "Place", "name": "Europe"},
]


def credential(name, issuer, date):
    c = {
        "@type": "EducationalOccupationalCredential",
        "name": name,
        "credentialCategory": "certification",
        "recognizedBy": {"@type": "Organization", "name": issuer},
    }
    if date:
        c["dateCreated"] = date
    return c


graph = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "WebSite",
            "@id": f"{SITE}/#website",
            "url": f"{SITE}/",
            "name": "Aakash Remesh",
            "inLanguage": "en",
            "publisher": {"@id": PERSON_ID},
        },
        {
            "@type": "ProfilePage",
            "@id": f"{SITE}/#webpage",
            "url": f"{SITE}/",
            "name": "Aakash Remesh — Bookkeeping & Accounting Systems Consultant",
            "isPartOf": {"@id": f"{SITE}/#website"},
            "about": {"@id": PERSON_ID},
            "mainEntity": {"@id": PERSON_ID},
            "primaryImageOfPage": f"{SITE}/assets/img/og-card.jpg",
            "inLanguage": "en",
        },
        {
            "@type": "Person",
            "@id": PERSON_ID,
            "name": "Aakash Remesh",
            "givenName": "Aakash",
            "familyName": "Remesh",
            "jobTitle": "Bookkeeping & Accounting Systems Consultant",
            "description": "Bookkeeping and accounting systems consultant with 9+ years of experience setting up, cleaning up and migrating QuickBooks Online, Sage Intacct, NetSuite, Zoho Books and Xero for eCommerce, SaaS, manufacturing and multi-entity businesses.",
            "url": f"{SITE}/",
            "image": f"{SITE}/assets/img/og.jpg",
            "address": {"@type": "PostalAddress", "addressRegion": "Kerala", "addressCountry": "IN"},
            "worksFor": {"@type": "Organization", "name": "Renocrew Solutions", "url": "https://www.renocrewsolutions.com"},
            "hasOccupation": {
                "@type": "Occupation",
                "name": "Accounting Systems Consultant",
                "occupationalCategory": "13-2011.00 Accountants and Auditors",
                "skills": "Bookkeeping, month-end close, ERP migration, multi-entity accounting, eCommerce reconciliation, inventory accounting",
            },
            "alumniOf": [
                {"@type": "EducationalOrganization", "name": "International Institute of Business Studies"},
                {"@type": "CollegeOrUniversity", "name": "University of Kerala"},
            ],
            "hasCredential": [credential(*c) for c in CREDENTIALS],
            "knowsAbout": [
                "Bookkeeping", "Month-end close", "Chart of Accounts design", "Accounting software migration",
                "Multi-entity accounting", "Intercompany reconciliation", "eCommerce accounting",
                "Shopify payout reconciliation", "Inventory accounting", "SaaS revenue recognition",
                "QuickBooks Online", "Intuit Enterprise Suite", "Sage Intacct", "Oracle NetSuite",
                "Zoho Books", "Xero", "A2X", "MyWorks",
            ],
            "knowsLanguage": ["English", "Hindi", "Malayalam", "Tamil"],
            "makesOffer": [
                {
                    "@type": "Offer",
                    "itemOffered": {
                        "@type": "Service",
                        "name": n,
                        "description": d,
                        "serviceType": n,
                        "provider": {"@id": PERSON_ID},
                        "areaServed": AREAS,
                    },
                }
                for n, d in SERVICES
            ],
            "sameAs": [LINKEDIN, UPWORK],
        },
        {
            "@type": "FAQPage",
            "@id": f"{SITE}/#faq",
            "isPartOf": {"@id": f"{SITE}/#webpage"},
            "mainEntity": [
                {"@type": "Question", "name": f["q"], "acceptedAnswer": {"@type": "Answer", "text": f["a"]}}
                for f in faq
            ],
        },
    ],
}

faq_html = "\n".join(
    f"""          <details>
            <summary>{html.escape(f["q"])}</summary>
            <div><p>{html.escape(f["a"])}</p></div>
          </details>"""
    for f in faq
)

page = (SRC / "index.html").read_text()
for key, value in {
    "{{JSONLD}}": json.dumps(graph, indent=2, ensure_ascii=False).replace("</", "<\\/"),
    "{{FAQ}}": faq_html,
    "{{SEAL}}": (SRC / "seal.svg").read_text().strip(),
    "{{CONTACT}}": (SRC / "contact.html").read_text().rstrip(),
}.items():
    assert key in page, f"template is missing {key}"
    page = page.replace(key, value)

(ROOT / "index.html").write_text(page)
print(f"index.html built: {len(page) // 1024} KB, {len(faq)} FAQs")
