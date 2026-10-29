// Sample reviews for the demo. They are labelled as samples on the page.
export interface Review {
  name: string
  city: string
  trip: string
  rating: number
  text: string
  pet?: string
}

export const REVIEWS: Review[] = [
  { name: 'Ananya R.', city: 'Bengaluru', trip: 'BLR → GOI · Flight', rating: 5, pet: 'Coco, Shih Tzu', text: 'First time flying with Coco and it was so easy. The pet row seat was clearly marked and the pet pass came with my boarding pass.' },
  { name: 'Rahul M.', city: 'Pune', trip: 'PNQ → NDLS · Train', rating: 5, pet: 'Bruno, Labrador', text: 'The pet coach kept our whole family and Bruno in one cabin. No more worrying about being split across coaches.' },
  { name: 'Fatima S.', city: 'Hyderabad', trip: 'HYD → DXB · Flight', rating: 4, text: 'Round trip to Dubai booked in minutes, and the ROUNDTRIP coupon took a nice chunk off the fare.' },
  { name: 'Karthik V.', city: 'Chennai', trip: 'MAS → SBC · Train', rating: 5, text: 'Got a waitlisted ticket and it confirmed automatically two days later. Clear status the whole time.' },
  { name: 'Meera J.', city: 'Kochi', trip: 'COK → MLE · Flight', rating: 5, pet: 'Miso, cat', text: 'Miso flew in-cabin to the Maldives with us. The vaccination check was simple and the fare breakdown was honest.' },
  { name: 'Arjun P.', city: 'New Delhi', trip: 'DEL → JAI · Flight', rating: 4, text: 'Clean, fast and no surprise fees. The student fare discount applied right at search.' },
]

export const averageRating = () => REVIEWS.reduce((s, r) => s + r.rating, 0) / REVIEWS.length
