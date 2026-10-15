import PropFirmCallout from "./PropFirmCallout";
import VpsCallout from "./VpsCallout";

// The two partner callouts every article ends with: where to get a VPS and
// where to get a prop firm account. ContentArticle (guides) and
// TutorialArticleView (tutorials and help articles) both render this as the
// last thing in the article, so a new article gets them without asking. The
// wording is English on every locale, hence the lang attribute.
export default function ArticleOffers() {
  return (
    <div className="ca-offers" lang="en">
      <VpsCallout />
      <PropFirmCallout />
    </div>
  );
}
