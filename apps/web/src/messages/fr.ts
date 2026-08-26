/**
 * Every user-facing string.
 *
 * Ground rule 7 (docs/README.md): no French text inline in a component. The file exists from the
 * first component so nobody has to go hunting for inlined copy later — and it is what makes a future
 * translation a data change rather than a codebase sweep.
 */
export const messages = {
  app: {
    name: "REACCHY",
    tagline: "Créez votre CV et votre portfolio professionnel",
  },

  nav: {
    home: "Accueil",
    resume: "CV Professionnel",
    portfolio: "Portfolio",
    portfolioPro: "Portfolio Pro",
    offers: "Offres",
    account: "Mon compte",
    signOut: "Se déconnecter",
  },

  errors: {
    generic: "Une erreur est survenue. Veuillez réessayer.",
    notFoundTitle: "Page introuvable",
    notFoundBody: "La page que vous cherchez n'existe pas ou a été déplacée.",
    errorTitle: "Quelque chose s'est mal passé",
    errorBody: "Nous n'avons pas pu afficher cette page. Réessayez dans un instant.",
    retry: "Réessayer",
    backHome: "Retour à l'accueil",
    /** Shown with a request id on a 5xx, so a user can quote it to support. */
    reference: "Référence",
  },

  common: {
    loading: "Chargement…",
    of: "sur",
    remaining: "restant",
    remainingPlural: "restants",
    project: "projet",
    projects: "projets",
    modifiedOn: "Modifié le",
    open: "Ouvrir",
    edit: "Modifier",
    /**
     * Shown on the disabled edit control for a category whose builder does not exist yet.
     *
     * A visible-but-disabled button rather than no button: the row is a real project the user created,
     * and offering nothing at all reads as "this cannot be edited, ever". Disabled with a reason reads as
     * "not yet", which is the truth.
     */
    editUnavailable: "L'éditeur de cette catégorie n'est pas encore disponible.",
    seeAll: "Voir tout",
    /**
     * Shown when the table is a *window* onto more rows than it displays.
     *
     * The dashboard caps each category at 5 recent projects, and the footer used to print only the true
     * total — so a user with 8 CVs read "8 projets" above 5 rows and reasonably concluded the number was
     * wrong. Stating both halves is the fix: the count was never the bug, the silence about the cap was.
     */
    showingOf: (shown: number, total: number) => `${String(shown)} sur ${String(total)} affichés`,
  },

  dashboard: {
    greeting: "Bonjour",
    subtitle: "Voici un aperçu de votre travail.",
    /** Per-category empty state — the FIRST screen every new user sees, so it is a real deliverable. */
    empty: {
      resumeTitle: "Vous n'avez pas encore de CV",
      resumeBody:
        "Créez votre premier CV professionnel, personnalisez-le et téléchargez-le en PDF.",
      resumeCta: "Créer mon CV",
      portfolioTitle: "Vous n'avez pas encore de portfolio",
      portfolioBody:
        "Présentez votre travail sur une page web et partagez-la avec un lien personnalisé.",
      portfolioCta: "Créer mon portfolio",
      portfolioProTitle: "Vous n'avez pas encore de portfolio Pro",
      portfolioProBody: "La version Pro de votre portfolio artistique, avec fonctions avancées.",
      portfolioProCta: "Créer mon portfolio Pro",
    },
  },

  quota: {
    /** "2 sur 3 utilisés" */
    usedOf: (used: number, limit: number) => `${used} sur ${limit} utilisés`,
    remainingOf: (remaining: number, limit: number) =>
      `${remaining} sur ${limit} ${remaining === 1 ? "restant" : "restants"}`,
    unlimited: "Illimité",
    resetsOn: "Renouvellement le",
    /** The dashboard column. Replaced "Modifications", which counted saves against a lifted cap. */
    progress: "Progression",
    percent: (n: number) => `${String(n)} %`,
    /**
     * The breakdown behind the percentage.
     *
     * Added because "why 60%?" was asked the moment the bar shipped, and a number nobody can audit is a
     * number nobody trusts. Naming the sections that count — and their weights — makes the figure
     * checkable in a glance instead of arguable.
     */
    progressDetail: "Sections comptées",
    progressSteps: {
      profile: "Profil (nom, titre, contact, résumé)",
      experience: "Expérience",
      skills: "Compétences",
      education: "Formation",
      languages: "Langues",
    },
    revisions: "Modifications",
    exports: "Téléchargements",
    createQuota: "Créations",
    publications: "Publications",
    hosting: "Hébergement",
    storage: "Stockage",
    customSlug: "Lien personnalisé",
  },

  offers: {
    title: "Nos offres",
    subtitle:
      "Créez et modifiez vos CV gratuitement. Un abonnement est nécessaire pour les télécharger et publier vos portfolios.",
    /** Shown when the user arrived here from a blocked download. */
    fromDownload: "Pour télécharger votre CV en PDF, choisissez une offre ci-dessous.",
    perMonth: "1 mois",
    included: "Inclus",
    limits: "Limites appliquées",
    choose: "Choisir cette offre",
    /** No checkout exists yet — phase 7. */
    comingSoon: "Paiement bientôt disponible",
    contactUs: "Contactez-nous pour activer votre abonnement.",
    subscriptionNeeded: "Abonnement requis pour télécharger",
    upgradeShort: "voir les offres",
    seeAll: "Voir toutes les offres",
  },

  blocked: {
    NO_ACTIVE_SUBSCRIPTION: "Aucun abonnement actif pour cette catégorie.",
    SUBSCRIPTION_EXPIRED: "Votre abonnement a expiré. Renouvelez-le pour continuer.",
    ENTITLEMENT_EXHAUSTED: "Vous avez utilisé tout votre quota inclus.",
    /**
     * The free tier, spent. Same `blockedReason` as a paying customer's exhausted quota, different
     * message: this one is an upsell, theirs is a wait-for-renewal.
     */
    freeTierUsed:
      "La version gratuite permet 1 création par catégorie. Choisissez une offre pour en créer davantage.",
    subscribeCta: "Voir les offres",
  },

  status: {
    DRAFT: "Brouillon",
    READY: "Prêt",
    PUBLISHED: "Publié",
    ARCHIVED: "Archivé",
  },

  /**
   * The portfolio editor's copy.
   *
   * Its own block rather than reusing `resume.*`: the two forms share field *primitives* but almost no
   * labels, and a portfolio's vocabulary is the audited repo's audience — professions, abonnés, tarifs.
   */
  portfolio: {
    name: "Nom du portfolio",
    fullName: "Nom complet",
    profession: "Profession",
    professions: {
      actress: "Actrice",
      actor: "Acteur",
      model: "Mannequin",
      influencer: "Influenceur·euse",
      content_creator: "Créateur·rice de contenu",
      other: "Autre",
    },
    gender: "Genre",
    /**
     * Free text in the payload, a fixed list in the form — the audited repository's own options, plus the
     * refusal. "Ne se prononce pas" is not politeness padding: without it the only way to decline is to
     * leave the field blank, which is indistinguishable from not having reached it yet.
     */
    genders: {
      female: "Femme",
      male: "Homme",
      nonBinary: "Non-binaire",
      preferNot: "Ne se prononce pas",
    },
    location: "Ville",
    locationPlaceholder: "Tunis, Tunisie",
    phone: "Téléphone",
    addressText: "Adresse",
    showPhone: "Afficher mon téléphone sur la page publique",
    showDob: "Afficher ma date de naissance sur la page publique",
    tagline: "Accroche",
    taglinePlaceholder: "Optionnel — sous-titre du portfolio",
    description: "Description (sert à l'IA)",
    descriptionPlaceholder:
      "Quelques phrases sur votre parcours, votre style, ce que vous cherchez. C'est la base à partir de laquelle le contenu du portfolio est écrit.",
    headline: "Accroche (headline)",
    biography: "Biographie — section « À propos »",
    brandSummary: "Marque personnelle (brand summary)",
    skills: "Compétences",
    skillsLabel: "Compétences (séparées par des virgules)",
    skillsPlaceholder: "Photographie, Direction artistique, Storytelling",
    /**
     * Warns that generation *overwrites*.
     *
     * These four fields are the ones the AI writes. Someone who has just spent ten minutes polishing a
     * biography and then presses "générer" deserves to have been told first — the reference says the same
     * thing above the same block.
     */
    contentHint:
      "Ces champs sont ceux que l'IA rédige. Si vous relancez la génération, vos modifications seront remplacées.",
    followers: "Abonnés",
    followersShort: "abonnés",
    subscribers: "Abonnés YouTube",
    reach: "Portée (reach)",
    engagement: "Engagement",
    audienceHint: "Chiffres déclaratifs, affichés tels quels sur votre page.",
    experienceType: "Type",
    types: {
      acting_credit: "Rôle / casting",
      brand_collab: "Collaboration de marque",
      other: "Autre",
    },
    experienceTitle: "Intitulé",
    experiencePlaceholder: "Titre / marque",
    addExperience: "+ Ajouter une expérience",
    role: "Rôle",
    year: "Année",
    note: "Précisions",
    workTitle: "Titre",
    workTitlePlaceholder: "Titre du projet",
    workCategory: "Catégorie",
    workDescription: "Description",
    workDescriptionPlaceholder: "Description courte",
    addWork: "+ Ajouter un projet",
    imageUrl: "URL de l'image",
    featured: "En vedette",
    pricingCategory: "Catégorie (reels, live, événements…)",
    /** The reference's four presets. `category` stays free text in the payload — a creator names their own. */
    pricingCategories: {
      /** The reference's cheapest prestation, and usually the first line of a rate card. */
      story: "Story",
      reels: "Reels",
      live: "Live",
      events: "Événements",
      other: "Autre",
    },
    pricingLabel: "Intitulé affiché",
    pricingLabelPlaceholder: "Libellé (ex : Reel Instagram)",
    addPricing: "+ Ajouter un tarif",
    priceMin: "Prix minimum (TND)",
    priceMax: "Prix maximum (TND)",
    availabilityText: "Message de disponibilité",
    availabilityDate: "Prochaine disponibilité",
    resumeUrl: "Lien vers votre CV / book",
    photos: "Photos",
    photosAdd: "Ajouter des photos",
    photosUploading: (done: number, total: number) =>
      `Téléversement… ${String(done)} / ${String(total)}`,
    photosEmpty: "Aucune photo. Un portfolio sans images n'a pas grand-chose à montrer.",
    photosRejected: "Aucun fichier accepté. JPG, PNG ou WebP, 5 Mo maximum.",
    cover: "Couverture",
    setCover: "Définir comme couverture",
    removePhoto: "Supprimer cette photo",

    /**
     * The publish action. Called "générer le lien" because that is what the user is asking for — the
     * shareable URL — not because publication is a side effect of it.
     */
    generateLink: "Générer le lien du portfolio",
    regenerateLink: "Lien public",
    linkReady: "Votre portfolio est en ligne :",
    copyLink: "Copier le lien",
    linkCopied: "Lien copié",
    linkExpires: "Hébergement jusqu'au",
    publishing: "Publication…",
    /** Publication is entitlement-gated, so a refusal is normal and needs its own explanation. */
    publishBlocked:
      "La publication nécessite un abonnement pour cette catégorie. Choisissez une offre pour obtenir votre lien.",
    /* --- Portfolio Pro: video --- */
    coverVideo: "Vidéo de couverture",
    coverVideoEmpty:
      "Aucune vidéo de couverture. Elle remplace le diaporama photo en haut de votre page.",
    videos: "Vidéos",
    videosEmpty: "Aucune vidéo. Ajoutez votre showreel ou vos extraits.",
    videoAdd: "Ajouter une vidéo",
    videoReplace: "Remplacer la vidéo",
    videoRemove: "Supprimer la vidéo",
    videoTitle: "Titre de la vidéo",
    videoUploading: (index: number, total: number, percent: number) =>
      `Téléversement ${String(index)}/${String(total)} — ${String(percent)} %`,
    videoRejected: "Aucun fichier accepté. MP4, WebM ou MOV, 100 Mo maximum.",
    videoHint: "MP4, WebM ou MOV · 100 Mo maximum par vidéo.",
    /** Named on the public page, above the reel. */
    videosSectionTitle: "Vidéos",
    videoSectionNote: "Showreel & extraits",

    /* --- AI generation of the written copy --- */
    generate: "Générer avec l'IA",
    generating: "Génération…",
    generateHint:
      "Rédige l'accroche, la biographie, les compétences et le résumé pour les marques à partir de vos informations.",
    generateNeedsName: "Renseignez votre nom complet pour activer la génération.",
    /**
     * Names the empty sections rather than saying "remplissez plus de champs".
     *
     * A model given only a name writes a confident, entirely invented biography — so the button is off
     * until there is real material. Saying *which* material turns a refusal into an instruction.
     */
    generateNeedsSources: (missing: string[]) =>
      `Remplissez au moins une de ces sections pour générer : ${missing.join(", ")}.`,
    generateSources: {
      description: "description",
      experiences: "expériences",
      skills: "compétences",
      socials: "réseaux",
    },
    generateConfirm:
      "La génération va remplacer l'accroche, la biographie, les compétences et le résumé pour les marques. Continuer ?",

    /* --- the public page a share link opens --- */
    untitled: "Portfolio",
    fromPrice: "à partir de",
    upToPrice: "jusqu'à",
    priceOnRequest: "Sur demande",
    poweredBy: "Portfolio créé avec",
    /** 404 copy. Deliberately vague about *why*: see the note on the public page. */
    notFoundTitle: "Ce portfolio n'est pas disponible",
    notFoundBody:
      "Le lien est peut-être incorrect, ou la page n'est plus en ligne. Demandez un nouveau lien à son auteur.",

    backToList: "Retour à mes portfolios",
    backToListPro: "Retour à mes portfolios Pro",
    sections: {
      identity: "Identité",
      photos: "Photos",
      content: "Contenu du portfolio (modifiable)",
      about: "À propos",
      contact: "Contact",
      socials: "Réseaux & audience",
      experiences: "Expériences",
      works: "Projets",
      pricing: "Tarifs",
      availability: "Disponibilité",
    },
  },

  resume: {
    identity: "Informations",
    name: "Nom du CV",
    fullName: "Nom complet",
    jobTitle: "Titre professionnel",
    phone: "Téléphone",
    location: "Ville",
    summary: "Résumé",
    /** The generator writes from the sections above it, so it lives at the bottom of the form. */
    generate: "Générer le résumé",
    /**
     * The field's own guidance, shown while it is empty.
     *
     * A placeholder rather than a line of help text underneath: it occupies the space the answer will
     * occupy, so it is read at the moment the user is deciding what to do, and it vanishes as soon as
     * they start — which is exactly when the advice stops being useful.
     */
    summaryPlaceholder:
      "Écrivez votre résumé professionnel ici — ou remplissez vos sections ci-dessus et cliquez sur « Générer le résumé » pour le composer automatiquement.",
    generateHint:
      "Rédigé par l'IA à partir de vos sections : expérience, compétences, formation, langues.",
    /** While the request is in flight. The model call takes a few seconds; a silent button reads as broken. */
    generating: "Rédaction en cours…",
    /**
     * Shown when the generation fell back to the local composer — the server has no `AI_API_KEY`, or the
     * provider was unreachable.
     *
     * It says **both** things the user needs: what they are looking at is the basic version, and the
     * button is still available. The one generation is deliberately not spent on a draft the server
     * could not write properly, so pressing again once generation is configured gets the real thing.
     */
    generateFallbackNote:
      "Brouillon simple — la rédaction par IA n'est pas disponible pour le moment. Vous pouvez réessayer plus tard.",
    /**
     * Shown when the once-per-CV rule has been lifted for this deployment
     * (`ALLOW_RESUME_REGENERATE=true`).
     *
     * It names the reason. A button that stays live after "génération plus disponible pour ce CV" would
     * otherwise read as the limit being broken rather than deliberately relaxed.
     */
    regenerateEnabled:
      "Régénération activée sur cet environnement (test) — relancer remplacera le résumé actuel.",
    /** Asked before a regeneration overwrites a résumé the user may have edited by hand. */
    generateConfirm: "La génération va remplacer le résumé actuel. Continuer ?",
    /** Shown once the single generation is spent. Says what is still possible, not only what is not. */
    generatedNote:
      "Résumé déjà généré une fois. Modifiez-le ou réécrivez-le librement — la génération n'est plus disponible pour ce CV.",
    /** Counts down, so the user knows how close they are rather than only that they are blocked. */
    generateNeedsSections: (filled: number, required: number, fields: string[]) =>
      `Encore ${String(required - filled)} section(s) à remplir pour générer (${String(filled)}/${String(required)}) — parmi : ${fields.join(", ")}.`,
    generateNeedsTitle: "Renseignez d'abord le titre professionnel.",
    /** Named individually so the hint says which section is missing, not just "des champs". */
    generateFields: {
      experiences: "l'expérience",
      skills: "les compétences",
      education: "la formation",
      languages: "les langues",
    },
    /**
     * The portrait. Shown only for European templates — a photo on a North-American résumé is a
     * liability, not a feature.
     */
    /** European conventions. Hidden for North-American templates — see the payload notes. */
    interests: "Loisirs / intérêts",
    interestsHint: "Séparés par des virgules.",
    drivingLicence: "Permis de conduire",
    drivingLicencePlaceholder: "ex. Permis B",
    photo: "Photo",
    photoUpload: "Ajouter une photo",
    photoReplace: "Remplacer",
    photoRemove: "Supprimer la photo",
    photoUploading: (percent: number) => `Téléversement… ${String(percent)} %`,
    photoHint: "JPG, PNG ou WebP · 5 Mo maximum · format portrait recommandé.",
    photoWrongType: "Format non accepté. Utilisez un JPG, un PNG ou un WebP.",
    photoTooLarge: "Image trop lourde (5 Mo maximum).",
    /** By far the likeliest failure right now, so it gets its own message rather than a generic one. */
    photoNotConfigured:
      "Le téléversement n'est pas encore configuré (clé secrète Cloudinary manquante). Contactez l'administrateur.",
    photoFailed: "Le téléversement a échoué. Réessayez.",
    /** The language the CV is printed in — not the dashboard's, which is French for everyone. */
    language: "Langue du CV",
    languageFr: "Français",
    languageEn: "English",
    /** Replaces the old two-value "Modèle" switch, which had no second renderer behind it. */
    template: "Modèle",
    templateStyle: "Style de CV",
    templateStyles: {
      NORTH_AMERICA: "Canada / États-Unis",
      EUROPE: "Europe",
    },
    /**
     * Generic, not Europe-specific.
     *
     * It said "les modèles européens arrivent bientôt" while Europe was the empty tab. The three designs
     * turned out to be European, so the empty side flipped — and copy that names one continent is copy
     * that goes stale the next time a template is re-filed.
     */
    templateStyleEmpty:
      "Aucun modèle graphique pour ce format pour l'instant. Le modèle ATS ci-dessus convient à toutes les candidatures en ligne.",
    templates: {
      ats: "ATS (texte brut)",
      // Canada / États-Unis
      classic: "Classique",
      timeline: "Timeline",
      blush: "Élégant",
      // Europe
      aurora: "Crème",
      navy: "Marine",
      terracotta: "Terracotta",
    },
    /**
     * The trade-off, stated on the card that makes it.
     *
     * A two-column CV reads better to a person and worse to a machine — a naive parser crosses the page
     * left-to-right and interleaves the sidebar into the job descriptions. Saying so where the choice
     * happens is the difference between an informed decision and a surprise rejection.
     */
    atsSafe: "Lisible ATS",
    atsRisky: "2 colonnes",
    atsSafeHint:
      "Ce modèle est sur une colonne : il est lu correctement par les logiciels de recrutement (ATS). Recommandé pour les candidatures en ligne.",
    atsRiskyHint:
      "Ce modèle est sur deux colonnes : plus élégant à l'œil, mais certains logiciels de recrutement mélangent les colonnes. À privilégier pour une candidature envoyée directement à un recruteur.",
    save: "Enregistrer",
    /**
     * Shown at rest, so the user knows their work is safe without having pressed anything.
     *
     * It replaces the old `saveHint` ("Chaque enregistrement consomme une modification de votre
     * quota."), which stopped being true when the revision cap was lifted — leaving it would have told
     * a customer they were spending something they are not.
     */
    autosaveHint: "Vos modifications sont enregistrées automatiquement.",
    savingNow: "Enregistrement…",
    unsaved: "Modifications non enregistrées.",
    savedAt: "Enregistré à",
    backToList: "Retour à mes CV",
    watermark: "APERÇU · REACCHY",
    watermarkNotice:
      "Cet aperçu est filigrané. Téléchargez votre CV pour obtenir la version finale sans filigrane.",
    download: "Télécharger en PDF",
    add: "Ajouter",
    addBullet: "Ajouter un point",
    remove: "Supprimer",
    moveUp: "Monter",
    moveDown: "Descendre",
    bullets: "Points clés",
    sections: {
      profile: "Profil",
      experience: "Expérience professionnelle",
      skills: "Compétences",
      projects: "Projets",
      languages: "Langues",
      education: "Formation",
      /** Last in the form, first on the printed sheet. */
      summary: "Résumé professionnel",
    },
    fields: {
      company: "Entreprise",
      companyNote: "Précision (ex. « (Remote) »)",
      start: "Début (AAAA/MM)",
      end: "Fin (vide = Aujourd'hui)",
      heading: "Intitulé du groupe",
      items: "Éléments",
      technologies: "Technologies",
      description: "Description",
      github: "GitHub",
      demo: "Démo",
      website: "Site web",
      linkedin: "LinkedIn",
      degree: "Diplôme",
      institution: "Établissement",
      detail: "Détail",
      level: "Niveau",
      languageName: "Langue",
    },
    printHint:
      "L'aperçu s'ouvre dans un nouvel onglet ; choisissez « Enregistrer au format PDF » dans la boîte de dialogue.",
  },

  account: {
    title: "Mon compte",
    profile: "Profil",
    subscriptions: "Abonnements",
    noSubscriptions: "Vous n'avez aucun abonnement pour le moment.",
    fullName: "Nom complet",
    email: "Adresse e-mail",
    save: "Enregistrer",
    saved: "Enregistré",
    period: "Période",
    plan: "Offre",
  },
} as const;
