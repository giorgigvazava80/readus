import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { isAdminAppHost } from "@/lib/runtime";

export type AppLanguage = "en" | "ka";

type Dictionary = Record<string, string>;

const STORAGE_KEY = "readus_language";

const dictionaries: Record<AppLanguage, Dictionary> = {
  en: {
    "title.user": "Readus",
    "title.admin": "Readus Admin",

    "lang.label": "Language",
    "lang.switchToKa": "\u10e5\u10d0",
    "lang.switchToEn": "EN",

    "brand.user": "Readus",
    "brand.admin": "Readus Admin",

    "nav.home": "Home",
    "nav.browse": "ბიბლიოთეკა",
    "nav.dashboard": "Dashboard",
    "nav.newWork": "ახალი ნაშრომი",
    "nav.writerApp": "Writer App",
    "nav.myWorks": "ჩემი ნაშრომები",
    "nav.settings": "Settings",
    "nav.redactors": "Redactors",
    "nav.writerApps": "ავტორის განაცხადები",
    "nav.contentReview": "კონტენტის განხილვა",
    "nav.auditLogs": "აუდიტის ჩანაწერები",
    "nav.login": "Login",
    "nav.register": "Register",
    "nav.logout": "Logout",
    "nav.toggleMenu": "Toggle menu",

    "layout.cta.title": "Ready to share your story?",
    "layout.cta.subtitle": "Join hundreds of authors who've found their readership on Readus.",
    "layout.cta.button": "Join Free",
    "layout.footer.brandDesc": "A curated home for novels, short stories, and poetry. Quality writing, carefully crafted.",
    "layout.footer.explore": "Explore",
    "layout.footer.browseAll": "ბიბლიოთეკა",
    "layout.footer.books": "Books",
    "layout.footer.stories": "Stories",
    "layout.footer.poetry": "Poetry",
    "layout.footer.account": "Account",
    "layout.footer.writerApplication": "ავტორის განაცხადი",
    "layout.footer.myWorks": "ჩემი ნაშრომები",
    "layout.footer.about": "About",
    "layout.footer.ourStory": "Our Story",
    "layout.footer.editorialProcess": "Editorial Process",
    "layout.footer.privacyPolicy": "Privacy Policy",
    "layout.footer.contact": "Contact",
    "layout.footer.rights": "(c) 2026 Readus. All rights reserved.",
    "layout.footer.tagline": "A home for stories worth telling.",

    "login.portal": "Editorial Management Portal",
    "login.welcome": "Welcome to Readus",
    "login.adminTitle": "კონტენტის ზუსტი მოდერაცია",
    "login.userTitle": "გააგრძელე შენი ლიტერატურული გზა",
    "login.adminSubtitle": "შედი რედაქტორის ან ადმინის ანგარიშით ავტორის განაცხადებისა და ნაშრომების განსახილველად.",
    "login.userSubtitle": "შედი, რომ დაათვალიერო ნაშრომები, იურთიერთო ავტორებთან და მართო შენი სამუშაო პროცესი.",
    "login.adminHeading": "Admin Login",
    "login.heading": "Login",
    "login.adminNote": "Restricted to redactor/admin roles.",
    "login.note": "Sign in to your account.",
    "login.username": "მომხმარებლის სახელი ან ელფოსტა",
    "login.password": "Password",
    "login.signIn": "Sign In",
    "login.signingIn": "Signing in...",
    "login.createAccount": "Create account",
    "login.forgotPassword": "Forgot password",
    "login.error.missing": "შეიყვანე მომხმარებლის სახელი ან ელფოსტა და პაროლი.",
    "login.error.loadUser": "მიმდინარე მომხმარებლის ჩატვირთვა ვერ მოხერხდა.",
    "login.error.noAdminAccess": "ადმინ პორტალზე წვდომა არ გაქვს.",
    "login.success": "შესვლა წარმატებულია.",
    "login.error.failed": "Login failed.",

    "register.badge": "Create your Readus account",
    "register.title": "Reader First. Writer by Approval.",
    "register.subtitle": "Reader registration unlocks public reading, reviews, likes, and comments. If you choose writer, you will verify email and then complete the writer application before publication rights are granted.",
    "register.readerCardTitle": "Reader",
    "register.readerCardDesc": "Review, like, comment, and follow published works.",
    "register.writerCardTitle": "Writer Track",
    "register.writerCardDesc": "Submit writing proof after verification and wait for editorial review.",
    "register.heading": "Register",
    "register.note": "წვდომამდე ყველა ანგარიში საჭიროებს ელფოსტის ვერიფიკაციას.",
    "register.firstName": "სახელი",
    "register.lastName": "გვარი",
    "register.username": "მომხმარებლის სახელი",
    "register.email": "Email",
    "register.role": "Role",
    "register.roleReader": "Reader",
    "register.roleWriter": "Writer",
    "register.password": "Password",
    "register.passwordRepeat": "Repeat password",
    "register.create": "Create Account",
    "register.creating": "Creating account...",
    "register.haveAccount": "Already have an account?",
    "register.resend": "Resend verification",
    "register.error.required": "Fill all required fields.",
    "register.error.passwordMatch": "პაროლები არ ემთხვევა.",
    "register.success": "რეგისტრაცია წარმატებულია. ანგარიშის გასააქტიურებლად დაადასტურე ელფოსტა.",
    "register.error.failed": "Registration failed.",
    "register.error.resendBefore": "ვერიფიკაციის ხელახლა გასაგზავნად ჯერ დარეგისტრირდი.",
    "register.success.resent": "ვერიფიკაციის ელფოსტა ხელახლა გაიგზავნა.",
    "register.error.resendFailed": "Failed to resend verification.",

    "dashboard.workspace": "Personal Workspace",
    "dashboard.title": "Dashboard",
    "dashboard.signedInAs": "Signed in as",
    "dashboard.writerApplication": "ავტორის განაცხადი",
    "dashboard.verifyEmail": "Verify your email before using protected features.",
    "dashboard.forcePassword": "Password change is required before continuing.",
    "dashboard.books": "Books",
    "dashboard.chapters": "თავები",
    "dashboard.poems": "Poems",
    "dashboard.stories": "Stories",
    "dashboard.writerStatus": "ავტორის განაცხადი სტატუსი",
    "dashboard.status": "სტატუსი",
    "dashboard.submitted": "Submitted",
    "dashboard.reviewerComment": "Reviewer comment",
    "dashboard.noWriterApp": "No writer application yet. Submit one to unlock writer privileges after approval.",
    "dashboard.notifications": "Recent Notifications",
    "dashboard.noNotifications": "No notifications yet.",
    "dashboard.updating": "Updating dashboard...",
    "dashboard.partialError": "Some dashboard sections failed to load.",
    "dashboard.writerMode": "Writer mode active",
    "dashboard.writerModeDesc": "You are approved as writer. Start publishing books from your writer workspace.",
    "dashboard.newWork": "ახალი ნაშრომი",

    "role.anonymous": "anonymous",
    "role.reader": "reader",
    "role.pending_writer": "pending_writer",
    "role.writer": "writer",
    "role.redactor": "redactor",
    "role.admin": "admin",
    "role.root": "root",
  },
  ka: {
    "title.user": "Readus",
    "title.admin": "Readus ადმინი",

    "lang.label": "ენა",
    "lang.switchToKa": "ქა",
    "lang.switchToEn": "EN",

    "brand.user": "Readus",
    "brand.admin": "Readus ადმინი",

    "nav.home": "მთავარი",
    "nav.browse": "ბიბლიოთეკა",
    "nav.dashboard": "პანელი",
    "nav.newWork": "ახალი ნაშრომი",
    "nav.writerApp": "ავტორის განაცხადი",
    "nav.myWorks": "ჩემი ნაშრომები",
    "nav.settings": "პარამეტრები",
    "nav.redactors": "რედაქტორები",
    "nav.writerApps": "ავტორის განაცხადები",
    "nav.contentReview": "კონტენტის განხილვა",
    "nav.auditLogs": "აუდიტის ჟურნალი",
    "nav.login": "შესვლა",
    "nav.register": "რეგისტრაცია",
    "nav.logout": "გასვლა",
    "nav.toggleMenu": "მენიუს გადართვა",

    "layout.cta.title": "მზად ხარ გააზიარო შენი ამბავი?",
    "layout.cta.subtitle": "შეუერთდი ავტორებს, რომლებმაც Readus-ზე იპოვეს თავიანთი მკითხველი.",
    "layout.cta.button": "უფასოდ შეუერთდი",
    "layout.footer.brandDesc": "რომანების, მოთხრობებისა და პოეზიის გამორჩეული სივრცე.",
    "layout.footer.explore": "დათვალიერება",
    "layout.footer.browseAll": "ბიბლიოთეკა",
    "layout.footer.books": "წიგნები",
    "layout.footer.stories": "მოთხრობები",
    "layout.footer.poetry": "პოეზია",
    "layout.footer.account": "ანგარიში",
    "layout.footer.writerApplication": "ავტორის განაცხადი",
    "layout.footer.myWorks": "ჩემი ნაშრომები",
    "layout.footer.about": "ჩვენს შესახებ",
    "layout.footer.ourStory": "ჩვენი ისტორია",
    "layout.footer.editorialProcess": "სარედაქციო პროცესი",
    "layout.footer.privacyPolicy": "კონფიდენციალურობის პოლიტიკა",
    "layout.footer.contact": "კონტაქტი",
    "layout.footer.rights": "(c) 2026 Readus. ყველა უფლება დაცულია.",
    "layout.footer.tagline": "სივრცე ისტორიებისთვის, რომელთა მოყოლაც ღირს.",

    "login.portal": "სარედაქციო მართვის პორტალი",
    "login.welcome": "კეთილი იყოს შენი მობრძანება Readus-ზე",
    "login.adminTitle": "მოდერაცია ზუსტად",
    "login.userTitle": "გააგრძელე შენი ლიტერატურული გზა",
    "login.adminSubtitle": "შედი რედაქტორის ან ადმინის ანგარიშით, განაცხადებისა და ნაშრომების განსახილველად.",
    "login.userSubtitle": "შედი ანგარიშში, რათა წაიკითხო, დაემეგობრო ავტორებს და მართო შენი სამუშაო სივრცე.",
    "login.adminHeading": "ადმინის შესვლა",
    "login.heading": "შესვლა",
    "login.adminNote": "ხელმისაწვდომია მხოლოდ რედაქტორის/ადმინის როლებისთვის.",
    "login.note": "შედი შენს ანგარიშში.",
    "login.username": "მომხმარებლის სახელი",
    "login.password": "პაროლი",
    "login.signIn": "შესვლა",
    "login.signingIn": "შესვლა...",
    "login.createAccount": "ანგარიშის შექმნა",
    "login.forgotPassword": "დაგავიწყდა პაროლი?",
    "login.error.missing": "შეიყვანე მომხმარებლის სახელი და პაროლი.",
    "login.error.loadUser": "მომხმარებლის მონაცემების ჩატვირთვა ვერ მოხერხდა.",
    "login.error.noAdminAccess": "ადმინ პორტალზე წვდომა არ გაქვს.",
    "login.success": "წარმატებით შეხვედით.",
    "login.error.failed": "შესვლა ვერ მოხერხდა.",

    "register.badge": "შექმენი შენი Readus ანგარიში",
    "register.title": "ჯერ მკითხველი. ავტორი დამტკიცების შემდეგ.",
    "register.subtitle": "მკითხველის რეგისტრაცია ხსნის კითხვას, შეფასებებს, მოწონებებს და კომენტარებს. თუ აირჩევ ავტორს, ელ.ფოსტის ვერიფიკაციის შემდეგ შეავსე ავტორის განაცხადი.",
    "register.readerCardTitle": "მკითხველი",
    "register.readerCardDesc": "შეაფასე, მოიწონე, დააკომენტარე და გამოიწერე ნაშრომები.",
    "register.writerCardTitle": "ავტორის გზა",
    "register.writerCardDesc": "ვერიფიკაციის შემდეგ გაგზავნე ნიმუში და დაელოდე რედაქციის პასუხს.",
    "register.heading": "რეგისტრაცია",
    "register.note": "ყველა ანგარიშს სჭირდება ელ.ფოსტის ვერიფიკაცია.",
    "register.firstName": "სახელი",
    "register.lastName": "გვარი",
    "register.username": "მომხმარებლის სახელი",
    "register.email": "ელ.ფოსტა",
    "register.role": "როლი",
    "register.roleReader": "მკითხველი",
    "register.roleWriter": "ავტორი",
    "register.password": "პაროლი",
    "register.passwordRepeat": "გაიმეორე პაროლი",
    "register.create": "ანგარიშის შექმნა",
    "register.creating": "იქმნება ანგარიში...",
    "register.haveAccount": "უკვე გაქვს ანგარიში?",
    "register.resend": "ვერიფიკაციის ხელახლა გაგზავნა",
    "register.error.required": "შეავსე ყველა აუცილებელი ველი.",
    "register.error.passwordMatch": "პაროლები არ ემთხვევა.",
    "register.success": "რეგისტრაცია წარმატებულია. გაიაქტიურე ანგარიში ელ.ფოსტით.",
    "register.error.failed": "რეგისტრაცია ვერ მოხერხდა.",
    "register.error.resendBefore": "ჯერ დარეგისტრირდი, შემდეგ გაგზავნე ვერიფიკაცია.",
    "register.success.resent": "ვერიფიკაციის ელ.ფოსტა ხელახლა გაიგზავნა.",
    "register.error.resendFailed": "ვერიფიკაციის ხელახლა გაგზავნა ვერ მოხერხდა.",

    "dashboard.workspace": "პირადი სივრცე",
    "dashboard.title": "პანელი",
    "dashboard.signedInAs": "შესული ხარ როგორც",
    "dashboard.writerApplication": "ავტორის განაცხადი",
    "dashboard.verifyEmail": "დაცული ფუნქციების გამოყენებამდე დაადასტურე ელ.ფოსტა.",
    "dashboard.forcePassword": "გაგრძელებამდე საჭიროა პაროლის შეცვლა.",
    "dashboard.books": "წიგნები",
    "dashboard.chapters": "თავები",
    "dashboard.poems": "ლექსები",
    "dashboard.stories": "მოთხრობები",
    "dashboard.writerStatus": "ავტორის განაცხადის სტატუსი",
    "dashboard.status": "სტატუსი",
    "dashboard.submitted": "გაგზავნის დრო",
    "dashboard.reviewerComment": "რედაქტორის კომენტარი",
    "dashboard.noWriterApp": "ავტორის განაცხადი ჯერ არ გაქვს. გაგზავნე განაცხადი ავტორის უფლებებისთვის.",
    "dashboard.notifications": "ბოლო შეტყობინებები",
    "dashboard.noNotifications": "შეტყობინებები ჯერ არ არის.",
    "dashboard.updating": "პანელის განახლება...",
    "dashboard.partialError": "პანელის ზოგიერთი ნაწილი ვერ ჩაიტვირთა.",
    "dashboard.writerMode": "ავტორის რეჟიმი აქტიურია",
    "dashboard.writerModeDesc": "შენი ავტორის სტატუსი დამტკიცებულია. დაიწყე ახალი ნაშრომის გამოქვეყნება.",
    "dashboard.newWork": "ახალი ნაშრომი",

    "role.anonymous": "ანონიმური",
    "role.reader": "მკითხველი",
    "role.pending_writer": "ავტორი - მოლოდინში",
    "role.writer": "ავტორი",
    "role.redactor": "რედაქტორი",
    "role.admin": "ადმინი",
    "role.root": "root",
  },
};

interface I18nContextValue {
  language: AppLanguage;
  setLanguage: (next: AppLanguage) => void;
  toggleLanguage: () => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

function resolveInitialLanguage(): AppLanguage {
  return "ka";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>(() => resolveInitialLanguage());

  const setLanguage = (next: AppLanguage) => {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "ka" : "en");
  };

  useEffect(() => {
    const dict = dictionaries[language];
    document.documentElement.lang = language;
    document.title = isAdminAppHost()
      ? dict["title.admin"] || "Readus Admin"
      : dict["title.user"] || "Readus";
  }, [language]);

  const value = useMemo<I18nContextValue>(() => {
    const t = (key: string, fallback?: string) => {
      const dict = dictionaries[language];
      return dict[key] || fallback || key;
    };

    return {
      language,
      setLanguage,
      toggleLanguage,
      t,
    };
  }, [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}





