from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.pdfgen import canvas

HEADER = "HEARTH & ONE - POLICY REFERENCE: VETIC.IN"
FOOTER = "Competitor policy research (summary, not verbatim) - sourced from vetic.in on 2026-10-11"


class NumberedCanvas(canvas.Canvas):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._states = []

    def showPage(self):
        self._states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        n = len(self._states)
        for s in self._states:
            self.__dict__.update(s)
            self._decorate(n)
            super().showPage()
        super().save()

    def _decorate(self, n):
        self.saveState()
        if self._pageNumber > 1:
            self.setFont("Helvetica-Bold", 8)
            self.setFillColor(colors.HexColor("#475569"))
            self.drawString(54, 755, HEADER)
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.6)
            self.line(54, 747, 558, 747)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 34, FOOTER)
        self.drawRightString(558, 34, f"Page {self._pageNumber} of {n}")
        self.line(54, 46, 558, 46)
        self.restoreState()


def build(filename="Hearth_and_One_Policy_Reference_Vetic.pdf"):
    doc = SimpleDocTemplate(filename, pagesize=letter, leftMargin=54, rightMargin=54, topMargin=54, bottomMargin=54)
    ss = getSampleStyleSheet()
    primary = colors.HexColor("#1E3A2F"); secondary = colors.HexColor("#B45309")
    dark = colors.HexColor("#0F172A"); slate = colors.HexColor("#334155")
    light = colors.HexColor("#F8FAFC"); border = colors.HexColor("#E2E8F0")
    warn_bg = colors.HexColor("#FFFBEB"); warn_border = colors.HexColor("#FDE68A"); warn_text = colors.HexColor("#92400E")

    P = lambda n, **kw: ParagraphStyle(n, parent=ss['Normal'], **kw)
    title = P('t', fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=primary, spaceAfter=4)
    sub = P('s', fontName='Helvetica', fontSize=10, leading=14, textColor=secondary, spaceAfter=12)
    h1 = P('h1', fontName='Helvetica-Bold', fontSize=13, leading=17, textColor=primary, spaceBefore=14, spaceAfter=6, keepWithNext=True)
    h2 = P('h2', fontName='Helvetica-Bold', fontSize=10.5, leading=14, textColor=dark, spaceBefore=8, spaceAfter=3, keepWithNext=True)
    body = P('b', fontName='Helvetica', fontSize=8.5, leading=12.5, textColor=slate, spaceAfter=6)
    bullet = P('bl', parent=body, leftIndent=14, bulletIndent=4, spaceAfter=3) if False else ParagraphStyle('bl', parent=body, leftIndent=14, bulletIndent=4, spaceAfter=3)
    cell = P('c', fontName='Helvetica', fontSize=8, leading=11, textColor=dark)
    cellh = P('ch', fontName='Helvetica-Bold', fontSize=8, leading=11, textColor=colors.white)
    warn = P('w', fontName='Helvetica', fontSize=8, leading=11.5, textColor=warn_text)

    def bl(items):
        return [Paragraph(t, bullet, bulletText="•") for t in items]

    def table(rows, widths, header=True):
        data = [[Paragraph(c, cellh if (header and i == 0) else cell) for c in r] for i, r in enumerate(rows)]
        t = Table(data, colWidths=widths, repeatRows=1 if header else 0)
        st = [('VALIGN', (0,0), (-1,-1), 'TOP'), ('BOX', (0,0), (-1,-1), 0.5, border),
              ('INNERGRID', (0,0), (-1,-1), 0.5, border), ('TOPPADDING', (0,0), (-1,-1), 4.5),
              ('BOTTOMPADDING', (0,0), (-1,-1), 4.5), ('LEFTPADDING', (0,0), (-1,-1), 6), ('RIGHTPADDING', (0,0), (-1,-1), 6),
              ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light])]
        if header:
            st.append(('BACKGROUND', (0,0), (-1,0), primary))
        t.setStyle(TableStyle(st))
        return t

    s = []
    s.append(Paragraph("HEARTH & ONE", title))
    s.append(Paragraph("POLICY REFERENCE: VETIC.IN (PETPAI TECHNOLOGIES PRIVATE LIMITED)", P('x', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=dark, spaceAfter=2)))
    s.append(Paragraph("Terms of Service, Privacy Policy, refund / cancellation and grievance terms - what they say, what is missing, and what to borrow", sub))
    s.append(HRFlowable(width="100%", thickness=1.5, color=primary, spaceBefore=0, spaceAfter=10))

    s.append(table([
        ["<b>Source pages:</b> vetic.in/terms-of-service, vetic.in/privacy-policy", "<b>Reviewed:</b> 11 Oct 2026"],
        ["<b>Operator:</b> Petpai Technologies Pvt. Ltd., Gurugram, Haryana", "<b>Business:</b> Vet clinics, vet-at-home, pharmacy, pet shop"],
    ], [300, 204], header=False))
    s.append(Spacer(1, 8))
    box = Table([[Paragraph("<b>NOTE:</b> This is a plain-language summary of another company's published policies, for benchmarking only. "
                            "Do not copy their text into Hearth & One documents; their wording is their copyright and reflects a clinic-and-pharmacy "
                            "business, not a frozen pet-food business. Final Hearth & One policies need review by Indian legal counsel.", warn)]], colWidths=[504])
    box.setStyle(TableStyle([('BACKGROUND', (0,0), (-1,-1), warn_bg), ('BOX', (0,0), (-1,-1), 1, warn_border),
                             ('TOPPADDING', (0,0), (-1,-1), 6), ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                             ('LEFTPADDING', (0,0), (-1,-1), 8), ('RIGHTPADDING', (0,0), (-1,-1), 8)]))
    s += [box, Spacer(1, 6)]

    s.append(Paragraph("1. What Vetic Publishes", h1))
    s.append(Paragraph("Only two legal pages exist, both linked from the footer: a Terms of Service and a Privacy Policy. "
                       "Every other policy is folded into the Terms. Probing common URLs (refund, cancellation, shipping, returns, disclaimer, grievance) returned 404.", body))
    s.append(table([
        ["Policy", "Where it lives", "Status"],
        ["Terms of Service", "/terms-of-service (23 numbered sections)", "Published"],
        ["Privacy Policy", "/privacy-policy (8 numbered sections + app account-deletion steps)", "Published"],
        ["Refund / Return / Cancellation", "Inside Terms, section 5 (Fees and Payment)", "Embedded, no standalone page"],
        ["Shipping / Delivery", "One line in Terms section 5 (charges shown at checkout)", "No policy page"],
        ["Grievance Redressal", "Terms section 23 and Privacy Policy section 7", "Published (named officer in Terms)"],
        ["Cookie Policy", "Inside Privacy Policy", "Embedded"],
        ["Medical / telehealth disclaimer", "Terms sections 3 and 18 (brief)", "Embedded, thin"],
    ], [130, 254, 120]))

    s.append(Paragraph("2. Terms of Service - Summary by Section", h1))
    s.append(table([
        ["Section", "What it says (summarized)"],
        ["Intro / scope", "Governs the website and the Vetic app. Sells pet products (food, toys, accessories) and vet services (OPD, vaccination, surgery, grooming). Treated as an electronic record under the IT Act 2000; no signature needed."],
        ["1. Eligibility", "18+ only. Company may change or stop any feature without notice."],
        ["2. Account", "Account needs name, email, etc. User must keep details accurate and credentials confidential. One account per person; no transfer or resale. Company may suspend for false info or breach."],
        ["3. Services", "Product listings are invitations to offer; the order is the customer's offer and Vetic may accept, decline or limit it. Vet services are delivered by registered practitioners."],
        ["4. Acceptable use", "Long prohibited-conduct list: illegal or abusive content, IP infringement, spam, scraping, reverse engineering, malware, impersonation, content threatening India's sovereignty."],
        ["5. Fees and payment", "Prices in INR. Third-party payment gateway; Vetic is not liable for failed or unauthorised card payments. Extra shipping charges may apply."],
        ["6. Membership", "12-month validity, one pet per member, non-transferable, non-refundable, benefits can change at Vetic's discretion. Rs. 99 starter package gives tiered discounts (lab 5%, vaccination 10%, grooming 12%)."],
        ["7. PLUS consultations", "Describes the first-visit background review and full physical exam."],
        ["8. Pet Health Shield", "Insurance product (Universal SOMPO / HDFC Ergo named). Pay upfront and claim by reimbursement (up to 45 working days). Excludes pre-existing illness, elective surgery, prescription food, pregnancy surgeries. No NCB. Cancellation charges apply."],
        ["9-10. Ownership, copyright", "Vetic owns the platform, content and marks. Takedown notice procedure with a 21-day court-filing undertaking. Repeat infringers terminated."],
        ["11-12. Privacy, communications", "Points to Privacy Policy. Consent to SMS, WhatsApp, email and calls, and states that calls may be made even if the number is on DND/NCPR."],
        ["13-16. Licence, links, changes, termination", "Limited personal licence, India-only access, no endorsement of third-party sites, platform may change anytime, user may close account by emailing support."],
        ["17. Indemnity", "User indemnifies Vetic and affiliates for breach or platform use."],
        ["18. Disclaimers / liability", "Platform provided as-is. No warranty on safety or effectiveness of products or services; disclaims harm to patients. Pricing errors allow cancelling the sale. Liability capped at the amount paid."],
        ["19-22. Violation, termination, misc.", "Injunctive relief and legal costs on violation, force majeure, Indian law, exclusive Gurgaon courts, severability, entire agreement, unilateral amendments by posting."],
        ["23. Grievance", "Named Grievance Officer with email and postal address."],
    ], [120, 384]))

    s.append(Paragraph("3. Refunds, Returns, Cancellation and Advance Payment", h1))
    s.append(Paragraph("These are the terms most relevant to e-commerce. They are the only commerce-specific rules Vetic publishes.", body))
    s.append(table([
        ["Topic", "Vetic's rule"],
        ["Order cancellation (products)", "Orders cannot be cancelled once placed."],
        ["Returns (products)", "Only for damaged or expired products. Verified by customer photos or video."],
        ["Refund timeline (products)", "7-14 business days after verification."],
        ["Appointment advance", "Rs. 49 advance on some slots, fully redeemable against the clinic bill."],
        ["Cancel or reschedule", "Free if more than 3 hours before the slot. Within 3 hours a Rs. 49 fee is kept."],
        ["Advance refund timeline", "5-7 business days to the original payment source."],
        ["Billing disputes", "Email support@vetic.in; Vetic has sole discretion on resolution."],
    ], [140, 364]))

    s.append(Paragraph("4. Privacy Policy - Summary", h1))
    s.append(table([
        ["Area", "What it says (summarized)"],
        ["Acceptance", "Use of the platform or clicking 'I accept' equals consent. Incorporated into the Terms."],
        ["Purposes of use", "Account and login, identity checks, service delivery and improvement, personalisation, communications, fraud prevention, analytics and auditing, marketing, sharing with service providers and group companies."],
        ["Marketing", "Promotional emails can be opted out of; transactional messages cannot."],
        ["Cookies", "Functional, performance, advertising and social cookies. Persistent cookies last 30 minutes to 2 years. Users may block cookies in the browser."],
        ["Disclosure", "To comply with law, protect rights, in emergencies, to advisers, to vendors under confidentiality, as aggregated data, and in mergers or asset sales. May disclose without telling the user when legally required."],
        ["Security", "'Reasonable' measures meeting minimum legal standards. Liability excluded except for gross and wilful negligence."],
        ["Children", "Not for under-18s. Data from minors deleted when discovered."],
        ["User rights", "Object, restrict, access, correct, erase, port; withdraw consent by emailing support. Data kept as long as needed or legally required."],
        ["Grievance", "Email within 24 hours of the incident; acknowledgement in 24 hours; resolution within 15 days."],
        ["Changes", "May change at any time without notice; effective immediately."],
        ["Account deletion (app)", "Profile > Settings > Delete account > confirm. Records then deleted from the internal database."],
    ], [120, 384]))

    s.append(Paragraph("5. Gaps and Weak Points in Vetic's Policies", h1))
    s.append(Paragraph("Useful to know so Hearth & One does not inherit the same weaknesses.", body))
    s += bl([
        "<b>No standalone refund, shipping or return policy.</b> Payment gateways such as Razorpay normally expect separate, easy-to-find pages for these.",
        "<b>'Cannot be cancelled once placed' is rigid.</b> It gives the customer no path even before dispatch, which sits uneasily with consumer-protection expectations.",
        "<b>Returns are limited to damaged or expired items.</b> There is no 'wrong item delivered' or 'not as described' route.",
        "<b>DND override.</b> Claiming the right to call numbers registered on DND/NCPR is risky under TRAI rules. Hearth & One should not copy it, especially with DLT/MSG91 registration in progress.",
        "<b>Privacy Policy has no DPDP Act 2023 language</b>: no named data fiduciary, no consent-withdrawal mechanism beyond email, no breach-notification commitment, no retention periods, no data-principal rights process.",
        "<b>Third-party processors are not named</b> (payment gateway, analytics, advertising partners).",
        "<b>Duplicated text.</b> The Terms repeat the cancellation and returns paragraphs and the 'use only for permitted purposes' clause three times, which suggests unreviewed edits.",
        "<b>Address inconsistency.</b> The registered office is written differently in the Terms and Privacy Policy.",
        "<b>Grievance details differ.</b> The Privacy Policy lists only a support email, while the Terms name an officer.",
        "<b>Thin medical disclaimer.</b> One sentence on registered practitioners and a blanket disclaimer of patient harm. No telehealth limits or emergency guidance.",
        "<b>Unilateral change without notice</b> is common but weak. Better practice is to show the effective date and notify users of material changes.",
    ])

    s.append(Paragraph("6. What Hearth & One Can Learn", h1))
    s.append(Paragraph("<b>Good ideas worth adapting (in our own words)</b>", h2))
    s += bl([
        "Show the grievance officer's name, email and postal address in the Terms, and repeat it in the Privacy Policy.",
        "Give a clear in-app account deletion path and say what happens to the data afterwards.",
        "State the electronic-record clause (IT Act 2000) so no signature is needed.",
        "Give a specific refund timeline and a specific verification method (photo or video evidence).",
        "Add a pricing-error clause that allows cancelling mispriced orders.",
        "Cap liability at the amount paid for the order, to the extent the law allows.",
    ])
    s.append(Paragraph("<b>Where Hearth & One must go further (frozen pet food, not clinics)</b>", h2))
    s += bl([
        "Separate pages: Privacy Policy, Terms of Service, Shipping and Delivery, Return and Refund, and Grievance Redressal.",
        "Cold-chain specific rules: delivery windows, what the customer must do on arrival (refrigerate or freeze promptly), and how thawed or damaged-in-transit packs are handled. Say plainly that the food is blast-frozen, not fresh-cooked.",
        "A returns route for damaged, leaking, thawed, wrong or expired packs, with a photo window and a refund timeline. Perishable food usually cannot be returned for change of mind; say so clearly.",
        "Allow cancellation before dispatch; Vetic does not.",
        "A veterinary-advice and AI-assistant disclaimer: nutrition guidance and the chatbot are not a substitute for a vet, and the AI can be wrong.",
        "DPDP Act 2023 compliance: consent notice, purposes, rights process, retention, breach handling, named processors (payments, SMS, AI providers, analytics).",
        "Respect DND/NCPR and give a real opt-out for marketing, consistent with the DLT/MSG91 setup.",
        "Mobile store requirements: public Privacy Policy URL, account deletion instructions, and data-safety disclosures for Google Play and Apple.",
    ])

    s.append(Paragraph("7. Suggested Order of Work", h1))
    s.append(table([
        ["Priority", "Document", "Reason"],
        ["1", "Privacy Policy (DPDP-aligned)", "Blocks Apple and Google store submission and Razorpay review."],
        ["2", "Grievance Officer designation", "Legally required for e-commerce; needed in both Privacy Policy and Terms."],
        ["3", "Terms of Service (with vet and AI disclaimers)", "Core contract; limits liability for advice and nutrition guidance."],
        ["4", "Shipping and Delivery Policy (cold chain)", "Gateway requirement; frozen delivery needs specific rules."],
        ["5", "Return and Refund Policy", "Gateway requirement; existing 7-day policy is a workable base."],
    ], [50, 200, 254]))
    s.append(Spacer(1, 8))
    s.append(Paragraph("Sources: https://vetic.in/terms-of-service and https://vetic.in/privacy-policy, accessed 11 October 2026.", body))
    doc.build(s, canvasmaker=NumberedCanvas)
    print("wrote", filename)


if __name__ == "__main__":
    build()
