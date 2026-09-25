import sys
import os
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#475569"))
        
        # Running Header (pages > 1)
        if self._pageNumber > 1:
            self.drawString(54, 755, "SCOOBY'S KITCHEN — COMPLIANCE & LEGAL POLICY FRAMEWORK")
            self.setFont("Helvetica", 8)
            self.drawRightString(558, 755, "CONFIDENTIAL & PRIVILEGED")
            self.setStrokeColor(colors.HexColor("#CBD5E1"))
            self.setLineWidth(0.6)
            self.line(54, 747, 558, 747)

        # Running Footer (all pages)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748B"))
        self.drawString(54, 34, "Scooby's Kitchen Platform Governance • Prepared for Legal & Compliance Officer Consultation")
        page_text = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 34, page_text)
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.6)
        self.line(54, 46, 558, 46)
        self.restoreState()


def build_pdf(filename="Scooby_Kitchen_Legal_and_Compliance_Policy_Framework.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54,
    )

    styles = getSampleStyleSheet()

    # Color Palette: Scooby's Kitchen & Hearth & Hound
    c_primary = colors.HexColor("#1E3A2F")     # Deep Forest Green
    c_secondary = colors.HexColor("#B45309")   # Warm Turmeric / Amber
    c_dark = colors.HexColor("#0F172A")        # Slate 900
    c_slate = colors.HexColor("#334155")       # Slate 700
    c_light_bg = colors.HexColor("#F8FAFC")    # Slate 50
    c_border = colors.HexColor("#E2E8F0")      # Slate 200
    c_alert_bg = colors.HexColor("#FEF2F2")    # Red 50
    c_alert_border = colors.HexColor("#FECACA")# Red 200
    c_alert_text = colors.HexColor("#991B1B")  # Red 800
    c_warn_bg = colors.HexColor("#FFFBEB")     # Amber 50
    c_warn_border = colors.HexColor("#FDE68A") # Amber 200
    c_warn_text = colors.HexColor("#92400E")   # Amber 800

    # Custom Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=c_primary,
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        'DocSubTitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=c_secondary,
        spaceAfter=12,
    )
    h1_style = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_primary,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True,
    )
    h2_style = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=14,
        textColor=c_dark,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )
    body_style = ParagraphStyle(
        'BodyDark',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=c_slate,
        spaceAfter=6,
    )
    bullet_style = ParagraphStyle(
        'BulletText',
        parent=body_style,
        leftIndent=14,
        bulletIndent=4,
        spaceAfter=4,
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=c_dark,
    )
    table_cell_bold = ParagraphStyle(
        'TableCellBold',
        parent=table_cell,
        fontName='Helvetica-Bold',
        textColor=c_primary,
    )
    table_cell_header = ParagraphStyle(
        'TableCellHeader',
        parent=table_cell,
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.white,
    )
    alert_box_style = ParagraphStyle(
        'AlertBox',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=c_alert_text,
    )
    warn_box_style = ParagraphStyle(
        'WarnBox',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11.5,
        textColor=c_warn_text,
    )

    story = []

    # ==========================================
    # COVER / HEADER BANNER
    # ==========================================
    story.append(Paragraph("SCOOBY'S KITCHEN", title_style))
    story.append(Paragraph("E-COMMERCE & TELEMEDICINE LEGAL & COMPLIANCE POLICY FRAMEWORK", ParagraphStyle(
        'SubHeader', fontName='Helvetica-Bold', fontSize=12, leading=15, textColor=c_dark, spaceAfter=2
    )))
    story.append(Paragraph("Statutory Website & Mobile App Policies, Telehealth Disclaimers, Razorpay Compliance, and Store Mandates", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=c_primary, spaceBefore=0, spaceAfter=10))

    # Meta Table: Document Control
    meta_data = [
        [
            Paragraph("<b>Target Audience:</b> Legal Counsel / Compliance Officer", table_cell),
            Paragraph("<b>Document ID:</b> SK-COMP-POL-2026-V1", table_cell),
        ],
        [
            Paragraph("<b>Entity Scope:</b> Scooby's Kitchen (Web & Mobile Apps)", table_cell),
            Paragraph("<b>Effective Jurisdiction:</b> Republic of India (IT Act, DPDP, VCI)", table_cell),
        ],
        [
            Paragraph("<b>Payment Gateway:</b> Razorpay Live Merchant Verification", table_cell),
            Paragraph("<b>Mobile Platforms:</b> Google Play Store & Apple App Store", table_cell),
        ],
    ]
    t_meta = Table(meta_data, colWidths=[270, 234])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_meta)
    story.append(Spacer(1, 10))

    # ==========================================
    # EXECUTIVE SUMMARY & STATUTORY MATRIX
    # ==========================================
    story.append(Paragraph("1. Executive Regulatory Scope & Statutory Matrix", h1_style))
    story.append(Paragraph(
        "Scooby's Kitchen operates a multi-modal digital platform comprising fresh small-batch canine food e-commerce, "
        "ambient pet supplies, licensed veterinary telemedicine (WebRTC video consultations and digital prescriptions), "
        "and algorithmic AI pet nutritional advisory. This document synthesizes all mandatory policies required to satisfy "
        "Indian statutory law, payment gateway merchant approval (Razorpay), and Apple & Google mobile app guidelines.",
        body_style
    ))

    reg_headers = [Paragraph("Policy Document", table_cell_header), Paragraph("Statutory Authority / Governing Body", table_cell_header), Paragraph("Primary Legal & Business Risk Mitigated", table_cell_header)]
    reg_rows = [
        reg_headers,
        [
            Paragraph("<b>Terms & Conditions</b>", table_cell),
            Paragraph("Indian Contract Act, 1872; Consumer Protection (E-Commerce) Rules, 2020", table_cell),
            Paragraph("Limits warranty on perishable diets; defines user obligations on cold storage upon delivery.", table_cell)
        ],
        [
            Paragraph("<b>Privacy Policy</b>", table_cell),
            Paragraph("Digital Personal Data Protection (DPDP) Act, 2023; IT Act 2000 (SPDI Rules)", table_cell),
            Paragraph("Mandates explicit consent for processing owner phone, address, and pet medical histories.", table_cell)
        ],
        [
            Paragraph("<b>Cancellation & Refund</b>", table_cell),
            Paragraph("Razorpay Live Account Verification Mandate; RBI Payment Guidelines", table_cell),
            Paragraph("Protects against payment gateway chargebacks and fraudulent refunds on perishable food.", table_cell)
        ],
        [
            Paragraph("<b>Shipping & Delivery</b>", table_cell),
            Paragraph("Consumer Protection Act, 2019 (Misleading Representation Provisions)", table_cell),
            Paragraph("Establishes cold-chain delivery serviceability boundaries and customer delivery obligations.", table_cell)
        ],
        [
            Paragraph("<b>Veterinary Telehealth Disclaimer</b>", table_cell),
            Paragraph("Veterinary Council of India (VCI); Indian Veterinary Practitioners Tele-guidelines", table_cell),
            Paragraph("Immunizes platform against medical malpractice claims; clarifies online triage limits.", table_cell)
        ],
        [
            Paragraph("<b>Mobile App & Permissions</b>", table_cell),
            Paragraph("Apple App Store Review Guidelines (5.1.1); Google Play Store Policies", table_cell),
            Paragraph("Prevents store rejection through clear hardware disclosures and mandatory account deletion.", table_cell)
        ],
        [
            Paragraph("<b>Grievance Redressal</b>", table_cell),
            Paragraph("Information Technology Rules, 2021 (Rule 3); E-Commerce Rules, 2020", table_cell),
            Paragraph("Designates statutory Grievance Officer with 48h acknowledgement and 30d resolution SLA.", table_cell)
        ],
    ]
    t_reg = Table(reg_rows, colWidths=[120, 180, 204])
    t_reg.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_reg)
    story.append(Spacer(1, 12))

    # ==========================================
    # POLICY 1: TERMS & CONDITIONS
    # ==========================================
    story.append(Paragraph("2. Policy 1: General Terms and Conditions (Terms of Use)", h1_style))
    story.append(Paragraph("<b>Scope & Core Contractual Clauses:</b>", h2_style))
    story.append(Paragraph("• <b>Account Registration & Security:</b> Access to purchase products and book veterinary sessions requires phone number verification via OTP. Users are responsible for maintaining confidentiality of credentials.", bullet_style))
    story.append(Paragraph("• <b>Perishable Product Classification & Immediate Refrigeration:</b> Fresh small-batch canine diets are preservative-free and perishable. The consumer explicitly agrees to unpack and transfer fresh vacuum-sealed pouches into refrigeration (0°C to 4°C) immediately upon receipt. Scooby's Kitchen disclaims liability for spoilage caused by consumer failure to refrigerate.", bullet_style))
    story.append(Paragraph("• <b>Canine Allergy & Morbidity Disclaimer:</b> Ingredients are itemized on product packaging and online product cards. It is the pet parent's sole responsibility to ensure recipes do not contain allergens known to harm their canine. The platform is not liable for pre-existing systemic conditions or idiosyncratic food sensitivities.", bullet_style))
    story.append(Paragraph("• <b>Pricing & Inventory Discrepancy:</b> Prices are quoted in Indian Rupees (INR) inclusive of applicable GST. We reserve the right to cancel orders arising from typographical or technical pricing errors.", bullet_style))
    story.append(Spacer(1, 6))

    # ==========================================
    # POLICY 2: PRIVACY POLICY (DPDP ACT)
    # ==========================================
    story.append(Paragraph("3. Policy 2: Privacy Policy & Personal Data Protection", h1_style))
    story.append(Paragraph(
        "Structured in adherence to the <i>Digital Personal Data Protection (DPDP) Act, 2023</i>. "
        "The policy specifies what personal data is processed, the lawful grounds, third-party sub-processors, and user rights.",
        body_style
    ))
    story.append(Paragraph("<b>Data Categories Processed:</b>", h2_style))
    story.append(Paragraph("• <b>User Identity & Contact Data:</b> Full name, primary telephone number, email address, physical delivery address with geolocation coordinates.", bullet_style))
    story.append(Paragraph("• <b>Pet Health & Heritage Data:</b> Canine name, breed, age, weight, sterilization status, dietary preferences, clinical records, prescription history, and consultation video notes.", bullet_style))
    story.append(Paragraph("• <b>Financial & Transactional Records:</b> Razorpay order identifiers and transaction status tokens (Zero raw credit/debit card numbers or CVV are stored on Scooby's Kitchen servers).", bullet_style))
    
    story.append(Paragraph("<b>Third-Party Service Processors & Data Sharing:</b>", h2_style))
    story.append(Paragraph("• <b>Razorpay Software Private Limited:</b> For PCI-DSS compliant payment processing, webhook verification, and automated refund disbursement.", bullet_style))
    story.append(Paragraph("• <b>Shiprocket / Logistics Aggregators:</b> Sharing name, delivery address, and phone number for parcel transit and OTP-based doorstep delivery.", bullet_style))
    story.append(Paragraph("• <b>Firebase (Google Cloud Platform):</b> For phone identity toolkit authentication and Firebase Cloud Messaging (FCM) push notifications.", bullet_style))
    story.append(Paragraph("• <b>Meta Platforms Ireland / Cloud API:</b> For automated delivery of transactional WhatsApp OTPs and consultation appointment links.", bullet_style))
    story.append(Paragraph("• <b>Cloudinary Inc:</b> Encrypted cloud storage for pet medical documentation, pet profile pictures, and veterinary digital prescription PDFs.", bullet_style))
    
    story.append(Paragraph("<b>User Rights under DPDP Act 2023:</b>", h2_style))
    story.append(Paragraph("Users possess the unalienable right to request access to their stored data, rectify inaccurate records, withdraw consent, or demand complete erasure of personal and pet profiles via our Grievance Officer or self-service account deletion.", body_style))
    story.append(Spacer(1, 8))

    # ==========================================
    # POLICY 3: CANCELLATION & REFUNDS (RAZORPAY MANDATE)
    # ==========================================
    story.append(PageBreak()) # Clean page break for Policy 3
    story.append(Paragraph("4. Policy 3: Cancellation, Returns & Refund Policy (Razorpay Live Verification Mandate)", h1_style))
    
    # Alert Box for Razorpay requirement
    rz_box = [
        [
            Paragraph("<b>CRITICAL MERCHANT COMPLIANCE NOTICE:</b> Razorpay's live merchant onboarding audit strictly inspects this policy. The policy must explicitly define cancellation cut-offs, non-returnable categories (food hygiene), damage claim timeframes, and refund payout duration.", warn_box_style)
        ]
    ]
    t_rz = Table(rz_box, colWidths=[504])
    t_rz.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_warn_bg),
        ('BOX', (0,0), (-1,-1), 1, c_warn_border),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_rz)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Clause 3.1: Order Cancellation Rules</b>", h2_style))
    story.append(Paragraph("• <b>Food & Fresh Diet Orders:</b> Cancellations are permitted strictly within <b>1 hour of order placement</b>, or before the order status transitions to <i>'PACKED'</i> or <i>'DISPATCHED'</i>. Once small-batch fresh meals enter preparation or chilled dispatch, cancellations cannot be accepted due to perishable food waste.", bullet_style))
    story.append(Paragraph("• <b>Veterinary Telemedicine Consultations:</b> Pet parents may cancel or reschedule a confirmed video appointment up to <b>2 hours prior</b> to the scheduled appointment slot for a full refund. Cancellations under 2 hours or client no-shows are non-refundable as the veterinarian's dedicated time slot was reserved.", bullet_style))

    story.append(Paragraph("<b>Clause 3.2: Non-Returnable Perishable Goods Standard</b>", h2_style))
    story.append(Paragraph("Due to strict canine food safety, hygiene protocols, and cold-chain integrity, fresh-cooked meals and opened dry food bags are <b>non-returnable</b> once delivered. Under no circumstances can food products be returned to warehouse inventory after leaving courier custody.", body_style))

    story.append(Paragraph("<b>Clause 3.3: Damaged, Defective or Spoiled Goods Protocol</b>", h2_style))
    story.append(Paragraph("• In the unlikely event that a package is delivered with ruptured thermal seal, punctured pouches, or signs of transit spoilage, the client must notify customer support within <b>24 hours of delivery</b>.", bullet_style))
    story.append(Paragraph("• Notice must include clear photographic or video evidence showing the outer package, thermal label, and batch number.", bullet_style))
    story.append(Paragraph("• Verified claims will be offered an immediate complimentary expedited batch replacement or a 100% store refund.", bullet_style))

    story.append(Paragraph("<b>Clause 3.4: Refund Disbursement Timetable & Mode</b>", h2_style))
    story.append(Paragraph("Approved refunds are initiated programmatically via the Razorpay payment gateway to the <b>original source payment method</b> (Credit/Debit Card, UPI handle, or Net Banking account). Standard processing turnaround is <b>5 to 7 business banking days</b> depending on the issuing bank.", body_style))
    story.append(Spacer(1, 8))

    # ==========================================
    # POLICY 4: SHIPPING & DELIVERY
    # ==========================================
    story.append(Paragraph("5. Policy 4: Shipping, Fulfilment & Cold-Chain Policy", h1_style))
    story.append(Paragraph("• <b>Serviceable Delivery Boundaries:</b> Fresh cooked perishable meals are restricted to express regional zones equipped with cold-chain couriers. Ambient products (kibble, supplements) ship pan-India across all serviceable pincodes.", bullet_style))
    story.append(Paragraph("• <b>Insulated Thermal Packaging:</b> All fresh diets are packed in corrugated multi-layer shippers lined with food-grade thermal insulation and frozen non-toxic gel packs, engineered to maintain safe temperatures (< 8°C) for up to 36 hours in transit.", bullet_style))
    story.append(Paragraph("• <b>Delivery Timelines:</b> Express local city orders are fulfilled within 24–48 hours. Pan-India ambient shipments arrive within 3–5 business days. Dispatch tracking numbers and live courier links are transmitted via SMS and WhatsApp.", bullet_style))
    story.append(Paragraph("• <b>Failed Delivery Attempts:</b> Couriers make up to 2 delivery attempts. If delivery fails due to customer unreachability or incorrect address, perishable items cannot be salvaged and the order cannot be re-routed or refunded.", bullet_style))
    story.append(Spacer(1, 8))

    # ==========================================
    # POLICY 5: TELEHEALTH & AI DISCLAIMER
    # ==========================================
    story.append(Paragraph("6. Policy 5: Veterinary Telehealth & AI Consultation Disclaimer", h1_style))

    # Alert Box for Medical Disclaimer
    med_box = [
        [
            Paragraph("<b>LEGAL MEDICAL IMMUNITY CLAUSE:</b> Online video consultations are classified strictly as 'Tele-Triage, General Wellness Advisory, and Second Opinions'. Telemedicine DOES NOT and CANNOT replace hands-on physical clinical examinations in life-threatening emergency situations.", alert_box_style)
        ]
    ]
    t_med = Table(med_box, colWidths=[504])
    t_med.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_alert_bg),
        ('BOX', (0,0), (-1,-1), 1, c_alert_border),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 8),
        ('RIGHTPADDING', (0,0), (-1,-1), 8),
    ]))
    story.append(t_med)
    story.append(Spacer(1, 6))

    story.append(Paragraph("<b>Clause 5.1: Acute Emergency Protocol & Exclusion</b>", h2_style))
    story.append(Paragraph("If a pet exhibits critical symptoms—including but not limited to acute respiratory distress, severe hemorrhage, suspected gastric torsion (bloat), toxic ingestion, unconsciousness, severe seizure clusters, or polytrauma—the pet parent must bypass remote telemedicine and transport the patient to an open 24/7 physical animal hospital immediately.", body_style))

    story.append(Paragraph("<b>Clause 5.2: Veterinarian Licensure & Professional Independence</b>", h2_style))
    story.append(Paragraph("All veterinarians conducting video consultations on Scooby's Kitchen hold recognized Bachelor of Veterinary Science & Animal Husbandry (B.V.Sc & A.H.) degrees and maintain active registrations with the Veterinary Council of India (VCI) and respective State Veterinary Councils. Doctors exercise independent professional clinical judgment.", body_style))

    story.append(Paragraph("<b>Clause 5.3: Digital Prescriptions & Limitations</b>", h2_style))
    story.append(Paragraph("Digital prescriptions issued through the platform comply with prevailing tele-veterinary ethics. Veterinarians will not prescribe Schedule X, high-risk narcotics, or controlled substances via digital teleconsultations.", body_style))

    story.append(Paragraph("<b>Clause 5.4: Algorithmic AI Nutritionist & Vision Scanner Disclaimer</b>", h2_style))
    story.append(Paragraph("The Scooby AI Nutritional Chatbot and Breed/Skin Vision tools utilize computer vision and probabilistic machine learning models. <b>Their outputs are strictly educational, informational, and advisory in nature.</b> They do not constitute official clinical diagnoses. Pet parents must never alter medical regimens without consulting a qualified veterinarian.", body_style))
    story.append(Spacer(1, 8))

    # ==========================================
    # POLICY 6: APP STORE COMPLIANCE & PERMISSIONS
    # ==========================================
    story.append(PageBreak()) # Clean page break for Mobile & App Store
    story.append(Paragraph("7. Policy 6: Mobile App Permissions & Account Deletion (Apple & Google Play Mandates)", h1_style))
    story.append(Paragraph(
        "To comply with <b>Apple App Store Review Guideline 5.1.1(v)</b> and <b>Google Play Store User Data Policy</b>, "
        "the application must implement explicit permissions justifications and a permanent account deletion workflow.",
        body_style
    ))

    perm_headers = [Paragraph("Device Permission", table_cell_header), Paragraph("Exact Purpose & Technical Usage", table_cell_header), Paragraph("Policy Justification for App Store Review", table_cell_header)]
    perm_rows = [
        perm_headers,
        [
            Paragraph("<b>CAMERA</b><br/>(NSCameraUsageDescription)", table_cell),
            Paragraph("Live WebRTC video feed during veterinary consultations; photographing canine skin conditions or physical symptoms.", table_cell),
            Paragraph("Mandatory for teleconsultation video calls and pet profile creation. Never accessed in the background.", table_cell)
        ],
        [
            Paragraph("<b>MICROPHONE</b><br/>(NSMicrophoneUsageDescription)", table_cell),
            Paragraph("Bi-directional real-time audio transmission during veterinary teleconsultation appointments.", table_cell),
            Paragraph("Mandatory for speaking with the doctor. Activated only when inside the active consultation room.", table_cell)
        ],
        [
            Paragraph("<b>LOCATION</b><br/>(NSLocationWhenInUse)", table_cell),
            Paragraph("Detecting pincode serviceability and auto-filling accurate doorstep address coordinates for fresh deliveries.", table_cell),
            Paragraph("Ensures fresh food cold-chain viability. Never tracked in background; accessed only when checkout is opened.", table_cell)
        ],
        [
            Paragraph("<b>PHOTO LIBRARY</b><br/>(NSPhotoLibraryUsageDescription)", table_cell),
            Paragraph("Selecting canine medical records, historical prescriptions, and saving the generated Pet Heritage Passport card.", table_cell),
            Paragraph("User-initiated photo upload and saving commemorative pet records. Read/write limited to selected files.", table_cell)
        ],
    ]
    t_perm = Table(perm_rows, colWidths=[120, 204, 180])
    t_perm.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_perm)
    story.append(Spacer(1, 8))

    story.append(Paragraph("<b>Clause 6.1: Account Deletion & Right to Be Forgotten Protocol</b>", h2_style))
    story.append(Paragraph("• <b>Dual Deletion Pathways:</b> Users can delete their account directly within the Mobile App (<i>Profile $\\rightarrow$ Security $\\rightarrow$ Delete Account</i>) or via our public web portal (<i>https://yourdomain.com/account-deletion</i>).", bullet_style))
    story.append(Paragraph("• <b>Data Purge SLA:</b> Upon confirming account deletion, authentication credentials, saved addresses, pet profiles, and payment tokens are purged from active databases within <b>30 days</b>. Historical tax invoices and prescription ledgers are archived in encrypted cold storage strictly to satisfy statutory Indian commercial accounting laws.", bullet_style))

    story.append(Paragraph("<b>Clause 6.2: End User License Agreement (EULA) & Abusive Content Prohibition</b>", h2_style))
    story.append(Paragraph("Users agree to adhere to community decorum. Any abusive, obscene, or threatening language directed at attending veterinarians during video calls or in doctor reviews results in immediate account suspension and blacklisting.", body_style))
    story.append(Spacer(1, 8))

    # ==========================================
    # POLICY 7: WHATSAPP & SMS COMMUNICATIONS
    # ==========================================
    story.append(Paragraph("8. Policy 7: WhatsApp & Transactional SMS Communication Policy", h1_style))
    story.append(Paragraph("• <b>Explicit Consent & Opt-In:</b> By registering a mobile phone number, the customer expressly consents to receive transactional OTPs, order milestone alerts, delivery tracking links, and consultation reminders via SMS and Meta WhatsApp Business Cloud API.", bullet_style))
    story.append(Paragraph("• <b>Promotional Broadcasts & Opt-Out:</b> Promotional recipe offers and discount newsletters are dispatched only to opted-in users. Users can opt out of promotional messages instantly by replying with 'STOP' or toggling notification preferences in mobile settings.", bullet_style))
    story.append(Spacer(1, 8))

    # ==========================================
    # POLICY 8: STATUTORY GRIEVANCE OFFICER
    # ==========================================
    story.append(Paragraph("9. Policy 8: Statutory Grievance Redressal Officer & Corporate Disclosure", h1_style))
    story.append(Paragraph(
        "In accordance with the <b>Information Technology Act, 2000</b>, the <b>IT (Intermediary Guidelines) Rules, 2021</b>, "
        "and the <b>Consumer Protection (E-Commerce) Rules, 2020</b>, the contact coordinates of the Grievance Redressal Officer are published below:",
        body_style
    ))

    gov_data = [
        [Paragraph("<b>Corporate Legal Entity:</b>", table_cell_bold), Paragraph("Scooby's Kitchen Private Limited", table_cell)],
        [Paragraph("<b>Registered Corporate Address:</b>", table_cell_bold), Paragraph("[Insert Registered Office Address, City, State, Pincode, India]", table_cell)],
        [Paragraph("<b>Corporate Identification Number (CIN):</b>", table_cell_bold), Paragraph("[Insert CIN Number / GSTIN Registration Number]", table_cell)],
        [Paragraph("<b>Designated Grievance Officer:</b>", table_cell_bold), Paragraph("[Insert Name of Grievance Redressal Officer]", table_cell)],
        [Paragraph("<b>Officer Official Email:</b>", table_cell_bold), Paragraph("grievance@scoobyskitchen.com (or legal@scoobyskitchen.com)", table_cell)],
        [Paragraph("<b>Customer Support Helpline:</b>", table_cell_bold), Paragraph("+91 [Insert Official Customer Support Phone Number]", table_cell)],
        [Paragraph("<b>Statutory Resolution SLA:</b>", table_cell_bold), Paragraph("Formal complaint acknowledgement within <b>48 hours</b>; substantive written resolution within <b>30 days</b>.", table_cell)],
    ]
    t_gov = Table(gov_data, colWidths=[180, 324])
    t_gov.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), c_light_bg),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('TOPPADDING', (0,0), (-1,-1), 4.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_gov)
    story.append(Spacer(1, 10))

    # ==========================================
    # ACTION CHECKLIST FOR OFFICER & TECH TEAM
    # ==========================================
    story.append(Paragraph("10. Digital Deployment Placement Checklist", h1_style))
    checklist_headers = [Paragraph("Digital Touchpoint", table_cell_header), Paragraph("Mandatory Policy Document To Display", table_cell_header), Paragraph("Technical Placement Requirement", table_cell_header)]
    checklist_rows = [
        checklist_headers,
        [
            Paragraph("<b>Website Footer</b><br/>(All Web Pages)", table_cell),
            Paragraph("Terms & Conditions, Privacy Policy, Refund Policy, Shipping Policy, Grievance Officer.", table_cell),
            Paragraph("Must be linked in the persistent footer visible on every webpage.", table_cell)
        ],
        [
            Paragraph("<b>Checkout Screen</b><br/>(Web & Mobile)", table_cell),
            Paragraph("Consent Checkbox: <i>'I agree to the Terms of Service & Cancellation/Refund Policy'</i>.", table_cell),
            Paragraph("Mandatory pre-submission clickwrap agreement before triggering Razorpay modal.", table_cell)
        ],
        [
            Paragraph("<b>Telemedicine Booking</b><br/>(Step 1 & Video Call)", table_cell),
            Paragraph("Veterinary Telehealth Disclaimer & Emergency Exclusion Notice.", table_cell),
            Paragraph("Modal acknowledgment before client joins WebRTC video room.", table_cell)
        ],
        [
            Paragraph("<b>Mobile App Settings</b><br/>(iOS & Android Drawer)", table_cell),
            Paragraph("Privacy Policy, Terms of Use (EULA), Hardware Permissions Disclosures, Delete Account button.", table_cell),
            Paragraph("Directly accessible inside Mobile Profile / Settings drawer.", table_cell)
        ],
        [
            Paragraph("<b>Store Metadata</b><br/>(App Store & Play Store)", table_cell),
            Paragraph("Public Privacy Policy URL & Account Deletion URL.", table_cell),
            Paragraph("Submitted in App Store Connect & Google Play Console app setup sheets.", table_cell)
        ],
    ]
    t_check = Table(checklist_rows, colWidths=[120, 204, 180])
    t_check.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), c_primary),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('BOX', (0,0), (-1,-1), 0.5, c_border),
        ('INNERGRID', (0,0), (-1,-1), 0.5, c_border),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, c_light_bg]),
        ('TOPPADDING', (0,0), (-1,-1), 4.5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4.5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(t_check)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"Successfully generated {filename}")

if __name__ == "__main__":
    build_pdf()
