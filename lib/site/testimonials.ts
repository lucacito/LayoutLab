// Customer feedback shown on the site. Every quote is the customer's own words, copied exactly from their message, with
// their written permission to quote the product feedback under their name and business. Never edit the wording of a quote,
// never add a quote that was not given to us, and use nothing about a customer's personal circumstances.
export type Testimonial = {
  quote: string;
  name: string;
  business: string;
  role: string;
};

export const MARVA_LORD: Testimonial = {
  quote: "I'm delighted with how much it has helped me, particularly with some quite complicated website builds.",
  name: 'Marva Lord',
  business: 'Griots Arts Ltd',
  role: 'Independent web designer',
};

/** A second, longer remark by the same customer about how the editor works with a designer. */
export const MARVA_LORD_ON_CONTROL: Testimonial = {
  quote:
    "The editor supports the person doing the work rather than attempting to replace them. I also value the emphasis on working directly within the client's website, without requiring their content to be exported elsewhere for editing.",
  name: 'Marva Lord',
  business: 'Griots Arts Ltd',
  role: 'Independent web designer',
};

export const HOME_TESTIMONIALS: Testimonial[] = [MARVA_LORD, MARVA_LORD_ON_CONTROL];
