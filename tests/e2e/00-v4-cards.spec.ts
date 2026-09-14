import {test,expect} from '@playwright/test';
test('readiness cards validate, swipe both ways, recover a draft and save only on confirmation',async({page,request})=>{
 await page.goto('/');
 const deck=page.getByRole('region',{name:'Daily check-in'});
 await expect(deck).toBeVisible();
 await deck.getByRole('button',{name:'Next →',exact:true}).click();
 await expect(deck.getByRole('spinbutton',{name:'Sleep hours'})).toBeVisible();
 await deck.getByRole('spinbutton',{name:'Sleep hours'}).fill('7.5');
 await page.reload();
 await expect(deck.getByRole('spinbutton',{name:'Sleep hours'})).toHaveValue('7.5');
 // Drag the non-interactive card title, not an input; horizontal travel advances.
 const title=deck.getByRole('heading',{name:'How long did you sleep?'});
 await title.scrollIntoViewIfNeeded();
 const box=(await title.boundingBox())!;
 await page.mouse.move(box.x+box.width*.8,box.y+10);await page.mouse.down();await page.mouse.move(box.x+10,box.y+10,{steps:8});await page.mouse.up();
 await expect(deck.getByRole('heading',{name:'How was your sleep?'})).toBeVisible();
 const second=deck.getByRole('heading',{name:'How was your sleep?'});await second.scrollIntoViewIfNeeded();const back=(await second.boundingBox())!;
 await page.mouse.move(back.x+10,back.y+10);await page.mouse.down();await page.mouse.move(back.x+back.width*.8,back.y+10,{steps:8});await page.mouse.up();
 await expect(deck.getByRole('spinbutton',{name:'Sleep hours'})).toHaveValue('7.5');
 await deck.getByRole('button',{name:'Next →',exact:true}).click();
 for(const question of ['How was your sleep?','How sore do you feel?','How is your energy?','How much stress today?','Ready to move?','How are you feeling?']){
   await deck.getByRole('spinbutton',{name:question,exact:true}).fill('7');
   await deck.getByRole('button',{name:'Next →',exact:true}).click();
 }
 await deck.getByRole('combobox',{name:'Pain or injury?'}).selectOption('false');
 await deck.getByRole('button',{name:'Next →',exact:true}).click();
 const before=await (await request.get('/api/bootstrap')).json();expect(before.db.readiness).toHaveLength(0);
 await deck.screenshot({path:'scratch/v4-readiness-review.png'});
 await page.setViewportSize({width:390,height:844});
 await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await deck.screenshot({path:'scratch/v4-readiness-mobile.png'});
 await deck.getByRole('button',{name:'Save readiness & unlock'}).click();
 await expect(deck).not.toBeVisible();
 const after=await (await request.get('/api/bootstrap')).json();expect(after.db.readiness[0].sleepHours).toBe(7.5);
});
