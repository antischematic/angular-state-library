
import {ThemeProvider} from "./fixtures/template-provider/theme-provider";
import {render, screen} from "@testing-library/angular";

describe("TemplateProvider", () => {
   it("should be selectable", async () => {
      const { changeInput } = await render(ThemeProvider)

      expect(screen.getByText("Default", { selector: "button" })).toHaveStyle({ color: "rgb(255, 0, 0)" })
      expect(screen.getByText("Current", { selector: "button" })).toHaveStyle({ color: "rgb(0, 255, 0)" })

      changeInput({
         theme: {
            color: "rgb(0, 0, 255)"
         }
      })

      expect(screen.getByText("Default", { selector: "button" })).toHaveStyle({ color: "rgb(255, 0, 0)" })
      expect(screen.getByText("Current", { selector: "button" })).toHaveStyle({ color: "rgb(0, 0, 255)" })
   })
})
