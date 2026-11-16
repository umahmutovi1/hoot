import { setAddressGender } from '@/app/i18n'
import { isGender, storeGender, type Gender } from '@/lib/address'
import { useProfile, useUpdateProfile } from './profile'

/** The user's address form (`profiles.gender`) and how to change it: at once, then saved. */
export function useAddress() {
  const { data: profile } = useProfile()
  const update = useUpdateProfile()
  const gender = isGender(profile?.gender) ? profile.gender : null
  const setGender = (next: Gender) => {
    storeGender(next)
    setAddressGender(next)
    update.mutate({ gender: next })
  }
  return { gender, setGender }
}
